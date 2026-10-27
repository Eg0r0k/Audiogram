import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computed, effectScope, reactive, toValue, type EffectScope } from "vue";
import { db } from "@/db";
import type { AlbumEntity, ArtistEntity, PlaylistEntity } from "@/db/entities";
import type { QueueItem, QueueSource } from "@/modules/queue/types";
import { updatePlaylistAndSync } from "@/queries/playlist.queries";
import { AlbumId, ArtistId, PlaylistId } from "@/types/ids";
import type { PlayerTrack } from "@/types/track";

const mockQueueState = reactive({
  currentItem: null as QueueItem | null,
});

// What the source behind a remote playlist can say about it.
const remote = reactive({
  listed: [] as { id: string; name: string }[],
  meta: null as { name: string } | null,
});

vi.mock("@/modules/queue/store/queue.store", () => ({
  useQueueStore: () => mockQueueState,
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("@/modules/sources/composables/useSourceCatalog", () => ({
  useSourcePlaylists: (kind: unknown) => ({
    data: computed(() => (toValue(kind) ? remote.listed : undefined)),
  }),
  useSourcePlaylistMeta: (kind: unknown) => ({
    data: computed(() => (toValue(kind) ? remote.meta : undefined)),
  }),
}));

import { useQueueSourceLink } from "../useQueueSourceLink";
import { sources } from "@/modules/sources/registry";
import { ytSourceProvider } from "@/modules/youtube/source-provider";
import { ndSourceProvider } from "@/modules/sources/navidrome/provider";

// main.ts does this at bootstrap; the catalog-kind lookup below needs it.
sources.register(ndSourceProvider);
sources.register(ytSourceProvider);

const album = (id: string, title: string): AlbumEntity =>
  ({ id: AlbumId(id), title, artistId: ArtistId("ar1"), pinned: 1, addedAt: 1, updatedAt: 1 });
const artist = (id: string, name: string): ArtistEntity =>
  ({ id: ArtistId(id), name, pinned: 1, addedAt: 1, updatedAt: 1 });
const playlist = (id: string, name: string): PlaylistEntity =>
  ({ id: PlaylistId(id), name, trackIds: [], addedAt: 1, updatedAt: 1 });

const track = (overrides: Partial<PlayerTrack> = {}): PlayerTrack => ({
  kind: "ephemeral",
  id: "eph-1",
  title: "Song",
  artist: "Catalog Artist",
  albumName: "Catalog Album",
  source: { type: "url", url: "https://stream" },
  ...overrides,
} as PlayerTrack);

const setSource = (source: QueueSource, current: PlayerTrack = track()) => {
  mockQueueState.currentItem = { id: "q1" as QueueItem["id"], track: current, source, addedAt: 0 };
};

const until = async (holds: () => boolean) => {
  for (let i = 0; i < 400 && !holds(); i++) await new Promise(resolve => setTimeout(resolve, 5));
  expect(holds()).toBe(true);
};

describe("useQueueSourceLink", () => {
  let scope: EffectScope;

  const start = () => scope.run(() => useQueueSourceLink())!;

  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    mockQueueState.currentItem = null;
    remote.listed = [];
    remote.meta = null;
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
  });

  it("is null with an empty queue", () => {
    expect(start().link.value).toBeNull();
  });

  it.each<QueueSource["type"]>(["search", "manual", "history", "external", "unknown"])(
    "is null for a %s origin, which has no page",
    (type) => {
      setSource({ type } as QueueSource);
      expect(start().link.value).toBeNull();
    },
  );

  it("labels a recommended track without a page to go to", () => {
    setSource({ type: "autoplay", pick: "rank" });
    expect(start().link.value).toEqual({ label: "queue.fromRecommendations" });

    setSource({ type: "recommendation" });
    expect(start().link.value).toEqual({ label: "queue.fromRecommendations" });
  });

  it("names a library album through its row lookup", async () => {
    await db.albums.add(album("a1", "Discovery"));
    setSource({ type: "album", albumId: "a1" as never });
    const { link } = start();

    await until(() => link.value !== null);
    expect(link.value).toEqual({
      label: "Discovery",
      to: { name: "album", params: { id: "a1" } },
    });
  });

  it("stays null until the album row is loaded", async () => {
    setSource({ type: "album", albumId: "a1" as never });
    const { link } = start();
    expect(link.value).toBeNull();

    await db.albums.add(album("a1", "Discovery"));
    await until(() => link.value?.label === "Discovery");
  });

  it("names a catalog album off the track instead of the database", () => {
    setSource({ type: "album", albumId: "nd:album:x" as never });

    expect(start().link.value).toEqual({
      label: "Catalog Album",
      to: { name: "album", params: { id: "nd:album:x" } },
    });
  });

  it("names a library artist and a playlist", async () => {
    await db.artists.add(artist("ar1", "Daft Punk"));
    await db.playlists.add(playlist("p1", "Road trip"));
    const { link } = start();

    setSource({ type: "artist", artistId: "ar1" as never });
    await until(() => link.value !== null);
    expect(link.value).toEqual({
      label: "Daft Punk",
      to: { name: "artist", params: { id: "ar1" } },
    });

    setSource({ type: "playlist", playlistId: "p1" as never });
    await until(() => link.value?.label === "Road trip");
    expect(link.value).toEqual({
      label: "Road trip",
      to: { name: "playlist", params: { id: "p1" } },
    });
  });

  // The pin cascade leaves a real row under a branded id; that row is the
  // playlist's name, and no source needs asking.
  it("names a downloaded remote playlist off its own row", async () => {
    await db.playlists.add(playlist("nd:p9", "Saved mix"));
    remote.meta = { name: "Server copy" };
    setSource({ type: "playlist", playlistId: "nd:p9" as never });
    const { link } = start();

    await until(() => link.value?.label === "Saved mix");
  });

  // Navidrome lists its playlists, so the name is already in the sidebar's
  // cached list — no extra request to name what is playing.
  it("names a catalog playlist off the source's playlist list", () => {
    remote.listed = [{ id: "nd:p1", name: "Server mix" }];
    setSource({ type: "playlist", playlistId: "nd:p1" as never });

    expect(start().link.value?.label).toBe("Server mix");
  });

  // YouTube opens a playlist by id but has no catalog to enumerate, so the
  // list can never name it — its own metadata is what answers.
  it("names a catalog playlist off its metadata when the source lists none", () => {
    remote.meta = { name: "Chill mix" };
    setSource({ type: "playlist", playlistId: "yt:PL1" as never });

    expect(start().link.value).toEqual({
      label: "Chill mix",
      to: { name: "playlist", params: { id: "yt:PL1" } },
    });
  });

  it("labels liked and the whole library with translated names", () => {
    setSource({ type: "liked" });
    expect(start().link.value).toEqual({ label: "media.type.liked", to: { name: "liked" } });

    setSource({ type: "allMedia" });
    expect(start().link.value).toEqual({ label: "library.allMusic.title", to: { name: "all-music" } });
  });

  it("does not name an album with the row of the album queued before it", async () => {
    await db.albums.bulkAdd([album("a1", "Discovery"), album("a2", "Homework")]);
    setSource({ type: "album", albumId: "a1" as never });
    const { link } = start();
    await until(() => link.value?.label === "Discovery");

    setSource({ type: "album", albumId: "a2" as never });
    expect(link.value).toBeNull();
    await until(() => link.value?.label === "Homework");
  });

  it("useQueueSourceLink: follows the row after a write", async () => {
    const row = playlist("p1", "Road trip");
    await db.playlists.add(row);
    setSource({ type: "playlist", playlistId: "p1" as never });
    const { link } = start();
    await until(() => link.value?.label === "Road trip");

    await updatePlaylistAndSync(row, { name: "Night drive" });

    await until(() => link.value?.label === "Night drive");
    expect(link.value?.to).toEqual({ name: "playlist", params: { id: "p1" } });
  });
});
