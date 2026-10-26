import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import { db } from "@/db";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { TrackScope } from "@/db/repositories/track.scope";
import { EntityResolver } from "@/services/entity-resolver";
import { persistTracks } from "@/services/import/track-persister";
import { resetSearchIndex, syncSearchIndex } from "@/services/search/searchIndex";
import type { TrackToSave } from "@/services/types";
import type { Track } from "@/types/track";
import { AlbumId, TrackId } from "@/types/ids";
import type { RightPanelAddTracksPayload } from "@/modules/right-panel/types";
import AddTracksPanel from "../AddTracksPanel.vue";

const queries = vi.hoisted(() => ({
  searchTracksPaginated: vi.fn(),
  getTracksByIds: vi.fn(),
  addTracksToAlbumAndSync: vi.fn(),
  addTracksToArtistAndSync: vi.fn(),
  favoriteTracksAndSync: vi.fn(),
}));
vi.mock("@/queries/track.queries", async importOriginal => ({
  ...await importOriginal<typeof import("@/queries/track.queries")>(),
  ...queries,
}));
vi.mock("@/queries/playlist.queries", () => ({ addTracksToPlaylistAndSync: vi.fn() }));

const queue = vi.hoisted(() => ({ syncTracksMetadata: vi.fn() }));
vi.mock("@/modules/queue/store/queue.store", () => ({ useQueueStore: () => queue }));

const stubs = {
  EntitySelectPanel: {
    props: ["items", "search"],
    emits: ["confirm", "update:search"],
    template: `<div>
      <input data-testid="search" :value="search" @input="$emit('update:search', $event.target.value)" />
      <template v-for="(item, index) in items" :key="item.id">
        <slot name="row" :item="item" :index="index" />
      </template>
      <button type="button" data-testid="confirm" @click="$emit('confirm')"></button>
    </div>`,
  },
  TrackSelectRow: {
    props: ["track", "index", "isSelected"],
    emits: ["toggleSelect"],
    template: `<button type="button" :data-testid="'row-' + track.id" @click="$emit('toggleSelect', track, $event)"></button>`,
  },
};

const track = (overrides: Partial<Track>): Track => ({
  kind: "library",
  id: "t1" as Track["id"],
  title: "Glory Box",
  artist: "Portishead",
  artistIds: ["ar1" as Track["artistIds"][number]],
  albumId: "al1" as Track["albumId"],
  albumName: "Dummy",
  storagePath: "tracks/t1.mp3",
  source: TrackSource.LOCAL_INTERNAL,
  state: TrackState.READY,
  duration: 100,
  isLiked: false,
  ...overrides,
});

const STORED: TrackEntity = {
  id: TrackId("t1"),
  title: "Glory Box",
  artistName: "Portishead",
  albumTitle: "Dummy",
  artistIds: [],
  albumId: AlbumId("al1"),
  tagIds: [],
  source: TrackSource.LOCAL_INTERNAL,
  pinned: 1,
  state: TrackState.READY,
  storagePath: "tracks/t1.mp3",
  duration: 100,
  format: {},
  playCount: 0,
  addedAt: 1,
};

const renderPanel = (payload: RightPanelAddTracksPayload) => render(AddTracksPanel, {
  props: { payload },
  global: { plugins: [i18n, VueQueryPlugin], stubs },
});

const shownRows = () => screen.getAllByTestId(/^row-/).map(row => row.dataset.testid);

const importTrack = async (id: string) => {
  const item: TrackToSave = {
    trackId: TrackId(id),
    fileName: `${id}.mp3`,
    storagePath: `tracks/${id}.mp3`,
    fingerprint: `fp-${id}`,
    source: TrackSource.LOCAL_INTERNAL,
    meta: { title: id, artists: ["Imported"], album: "Imported", duration: 100, format: {} },
  };
  const resolver = new EntityResolver();
  await resolver.resolve([item.meta]);
  await persistTracks([item], resolver);
};

describe("AddTracksPanel", () => {
  beforeEach(async () => {
    for (const mock of Object.values(queries)) mock.mockReset();
    queue.syncTracksMetadata.mockReset();
    i18n.global.locale.value = "en";
    queries.addTracksToArtistAndSync.mockResolvedValue(undefined);
    queries.favoriteTracksAndSync.mockResolvedValue(undefined);
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    await db.tracks.add(STORED);
    resetSearchIndex();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hands the stored rows to the queue after adding tracks to an artist", async () => {
    const fresh = track({ artist: "Portishead, Beth Gibbons", artistIds: ["ar1", "ar2"] as Track["artistIds"] });
    queries.getTracksByIds.mockResolvedValue([fresh]);

    renderPanel({ entityType: "artist", entityId: "ar2" });

    await userEvent.click(await screen.findByTestId("row-t1"));
    await userEvent.click(screen.getByTestId("confirm"));

    await waitFor(() => expect(queue.syncTracksMetadata).toHaveBeenCalledWith([fresh]));
    expect(queries.getTracksByIds).toHaveBeenCalledWith(["t1"]);
    expect(queries.addTracksToArtistAndSync).toHaveBeenCalledOnce();
  });

  it("does the same for favorites, where the row's liked flag moves", async () => {
    const fresh = track({ isLiked: true });
    queries.getTracksByIds.mockResolvedValue([fresh]);

    renderPanel({ entityType: "favorite", entityId: "" });

    await userEvent.click(await screen.findByTestId("row-t1"));
    await userEvent.click(screen.getByTestId("confirm"));

    await waitFor(() => expect(queue.syncTracksMetadata).toHaveBeenCalledWith([fresh]));
  });

  it("reads the library from the top of the index by key, not by offset", async () => {
    const pageSpy = vi.spyOn(TrackScope.prototype, "page");
    renderPanel({ entityType: "favorite", entityId: "" });

    await screen.findByTestId("row-t1");

    expect(pageSpy).toHaveBeenCalledWith({ sort: "date_added_desc", after: null, limit: 50 });
    expect(queries.searchTracksPaginated).not.toHaveBeenCalled();
  });

  it("the add-tracks panel lists a track imported while it is open", async () => {
    renderPanel({ entityType: "favorite", entityId: "" });
    await screen.findByTestId("row-t1");

    await importTrack("new");

    await screen.findByTestId("row-new");
    expect(shownRows()).toEqual(["row-new", "row-t1"]);
  });

  it("add-tracks: a search string reads live rows and follows the index", async () => {
    await db.tracks.add({ ...STORED, id: TrackId("t2"), title: "Teardrop", storagePath: "tracks/t2.mp3" });
    renderPanel({ entityType: "favorite", entityId: "" });
    await screen.findByTestId("row-t2");

    await userEvent.type(screen.getByTestId("search"), "glory");
    await waitFor(() => expect(shownRows()).toEqual(["row-t1"]));

    await importTrack("glory-new");
    await syncSearchIndex({ tracks: [TrackId("glory-new")] });
    await screen.findByTestId("row-glory-new");

    await db.tracks.update(TrackId("t1"), { title: "Roads" });
    await syncSearchIndex({ tracks: [TrackId("t1")] });
    await waitFor(() => expect(shownRows()).toEqual(["row-glory-new"]));
  });
});
