import { render, screen, waitFor } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import { TrackSource, TrackState } from "@/db/entities";
import type { Track } from "@/modules/player/types";
import type { RightPanelAddTracksPayload } from "@/modules/right-panel/types";
import AddTracksPanel from "../AddTracksPanel.vue";

const queries = vi.hoisted(() => ({
  getTracksPaginated: vi.fn(),
  getTracksByIds: vi.fn(),
  addTracksToAlbumAndSync: vi.fn(),
  addTracksToArtistAndSync: vi.fn(),
  favoriteTracksAndSync: vi.fn(),
}));
vi.mock("@/queries/track.queries", () => queries);
vi.mock("@/queries/playlist.queries", () => ({ addTracksToPlaylistAndSync: vi.fn() }));

const queue = vi.hoisted(() => ({ syncTracksMetadata: vi.fn() }));
vi.mock("@/modules/queue/store/queue.store", () => ({ useQueueStore: () => queue }));

const stubs = {
  EntitySelectPanel: {
    props: ["items"],
    emits: ["confirm"],
    template: `<div>
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

const renderPanel = (payload: RightPanelAddTracksPayload) => render(AddTracksPanel, {
  props: { payload },
  global: { plugins: [i18n, VueQueryPlugin], stubs },
});

describe("AddTracksPanel", () => {
  beforeEach(() => {
    for (const mock of Object.values(queries)) mock.mockReset();
    queue.syncTracksMetadata.mockReset();
    i18n.global.locale.value = "en";
    queries.getTracksPaginated.mockResolvedValue({ tracks: [track({})], nextOffset: null, total: 1 });
    queries.addTracksToArtistAndSync.mockResolvedValue(undefined);
    queries.favoriteTracksAndSync.mockResolvedValue(undefined);
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
});
