import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { mount } from "@vue/test-utils";
import { db } from "@/db";
import { artistRepository } from "@/db/repositories";
import { AlbumId, ArtistId, PlaylistId } from "@/types/ids";

const route = vi.hoisted(() => ({ query: {} as Record<string, unknown> }));

vi.mock("vue-router", () => ({ useRoute: () => ({ query: route.query }) }));

vi.mock("../../registry", () => ({
  sources: {
    get: () => ({
      capabilities: {
        artists: { list: false, open: true },
        albums: { list: false, open: true },
        playlists: { list: false, open: true },
      },
    }),
  },
}));

import { useRemoteCatalogKind } from "../useRemoteCatalogKind";

const artist = (id: string, pinned: 0 | 1) =>
  db.artists.add({ id: ArtistId(id), name: "Artist", pinned, addedAt: 1, updatedAt: 1 });
const album = (id: string, pinned: 0 | 1) =>
  db.albums.add({ id: AlbumId(id), title: "Album", artistId: ArtistId("ar1"), pinned, addedAt: 1, updatedAt: 1 });
const playlist = (id: string) =>
  db.playlists.add({ id: PlaylistId(id), name: "Playlist", trackIds: [], addedAt: 1, updatedAt: 1 });

const until = async (holds: () => boolean) => {
  for (let i = 0; i < 400 && !holds(); i++) await new Promise(resolve => setTimeout(resolve, 5));
  expect(holds()).toBe(true);
};

const start = (entity: "artists" | "albums" | "playlists", id: string) => {
  let result!: ReturnType<typeof useRemoteCatalogKind>;
  mount(defineComponent({
    setup() {
      result = useRemoteCatalogKind(entity, ref(id));
      return () => h("div");
    },
  }));
  return result;
};

const resolve = async (entity: "artists" | "albums" | "playlists", id: string) => {
  const result = start(entity, id);
  await until(() => result.isResolved.value);
  return result;
};

describe("useRemoteCatalogKind", () => {
  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    route.query = {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("takes the local path for an unprefixed id without touching Dexie", async () => {
    const findById = vi.spyOn(artistRepository, "findById");

    const { remoteKind, isResolved } = await resolve("artists", "local-uuid");

    expect(remoteKind.value).toBeNull();
    expect(isResolved.value).toBe(true);
    expect(findById).not.toHaveBeenCalled();
  });

  it("opens the catalog for a remote id with no library row", async () => {
    const { remoteKind } = await resolve("albums", "yt:MPREb_x");

    expect(remoteKind.value).toBe("yt");
  });

  // The regression: downloading a YouTube track pins an artist row under the
  // same "yt:" id, the local search index lists it, and opening that result
  // must show the library artist rather than the live YouTube page.
  it("takes the local path when a pinned library row exists under the remote id", async () => {
    await artist("yt:UC1", 1);

    const { remoteKind, isLibraryEntity } = await resolve("artists", "yt:UC1");

    expect(isLibraryEntity.value).toBe(true);
    expect(remoteKind.value).toBeNull();
  });

  // A shadow row hangs off a download and carries no library meaning, so
  // browsing the catalog entity it came from must still work.
  it("keeps the catalog path when the only row is an unpinned shadow", async () => {
    await album("nd:al1", 0);

    const { remoteKind } = await resolve("albums", "nd:al1");

    expect(remoteKind.value).toBe("nd");
  });

  // The other half of the same coin: a link that came from searching the
  // source asked for the source's view, downloaded or not.
  it("keeps the catalog path when the link asked for it, pinned row or not", async () => {
    await artist("yt:UC1", 1);
    route.query = { catalog: "1" };

    const { remoteKind, isLibraryEntity, isResolved } = await resolve("artists", "yt:UC1");

    expect(isLibraryEntity.value).toBe(false);
    expect(remoteKind.value).toBe("yt");
    expect(isResolved.value).toBe(true);
  });

  it("treats any existing playlist row as a library playlist", async () => {
    await playlist("nd:pl1");

    const { remoteKind } = await resolve("playlists", "nd:pl1");

    expect(remoteKind.value).toBeNull();
  });

  it("reports unresolved until the lookup settles, so no page renders twice", () => {
    const result = start("artists", "yt:UC1");

    expect(result.isResolved.value).toBe(false);
    expect(result.remoteKind.value).toBeNull();
  });

  it("a lookup that fails resolves to the catalog instead of holding the page", async () => {
    vi.spyOn(artistRepository, "findById").mockRejectedValue(new Error("idb gone"));

    const { remoteKind, isLibraryEntity } = await resolve("artists", "yt:UC1");

    expect(isLibraryEntity.value).toBe(false);
    expect(remoteKind.value).toBe("yt");
  });

  it("useRemoteCatalogKind: follows the library row after a pin and after a delete", async () => {
    await artist("yt:UC1", 0);
    const { remoteKind, isLibraryEntity, isResolved } = await resolve("artists", "yt:UC1");
    expect(remoteKind.value).toBe("yt");

    await artistRepository.update(ArtistId("yt:UC1"), { pinned: 1 });
    await until(() => isLibraryEntity.value);
    expect(remoteKind.value).toBeNull();
    expect(isResolved.value).toBe(true);

    await artistRepository.delete(ArtistId("yt:UC1"));
    await until(() => remoteKind.value === "yt");
    expect(isLibraryEntity.value).toBe(false);
  });
});
