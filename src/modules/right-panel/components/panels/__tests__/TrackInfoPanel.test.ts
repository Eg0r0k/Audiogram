import { render, screen } from "@testing-library/vue";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import type { Track } from "@/modules/player/types";
import TrackInfoPanel from "../TrackInfoPanel.vue";

const queries = vi.hoisted(() => ({ getTrackEntityById: vi.fn() }));
vi.mock("@/queries/track.queries", () => ({
  trackQueries: {
    detail: (id: string) => ({ queryKey: ["tracks", id], queryFn: () => queries.getTrackEntityById(id) }),
  },
}));
vi.mock("@/queries/offlineCopy.queries", async () => {
  const { skipToken } = await import("@tanstack/vue-query");
  return {
    offlineCopyQueries: {
      detail: () => ({ queryKey: ["offlineCopies", "none"], queryFn: skipToken }),
    },
  };
});
vi.mock("@/modules/tracks/composables/useTrackDeletion", () => ({
  useTrackDeletion: () => ({ deleteWithUndo: vi.fn() }),
}));
vi.mock("@/components/dialogs/summonDialog", () => ({ summonDialog: vi.fn() }));

const slotStub = { template: "<div><slot /></div>" };
const stubs = {
  Scrollable: slotStub,
  RightPanelHeader: slotStub,
  DropdownMenu: slotStub,
  DropdownMenuTrigger: slotStub,
  DropdownMenuContent: slotStub,
  DropdownMenuItem: slotStub,
};

const payloadTrack = (): Track => ({
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
});

const entity = (overrides: Partial<TrackEntity>): TrackEntity => ({
  id: "t1",
  title: "Glory Box",
  artistName: "Portishead",
  albumTitle: "Dummy",
  artistIds: ["ar1"],
  albumId: "al1",
  tagIds: [],
  source: TrackSource.LOCAL_INTERNAL,
  storagePath: "tracks/t1.mp3",
  pinned: 0,
  state: TrackState.READY,
  duration: 100,
  format: {},
  playCount: 0,
  addedAt: 0,
  ...overrides,
} as TrackEntity);

const renderPanel = (track: Track) => render(TrackInfoPanel, {
  props: { payload: { track } },
  global: { plugins: [i18n, VueQueryPlugin], stubs },
});

describe("TrackInfoPanel", () => {
  beforeEach(() => {
    queries.getTrackEntityById.mockReset();
    i18n.global.locale.value = "en";
  });

  it("shows the stored track over the payload snapshot once the detail query resolves", async () => {
    queries.getTrackEntityById.mockResolvedValue(entity({
      artistName: "Portishead, Beth Gibbons",
      artistIds: ["ar1", "ar2"],
    }));

    renderPanel(payloadTrack());

    expect(await screen.findByText("Portishead, Beth Gibbons")).toBeInTheDocument();
    expect(screen.getByText("ar1, ar2")).toBeInTheDocument();
    expect(screen.queryByText("Portishead")).not.toBeInTheDocument();
  });

  it("falls back to the payload while the detail query is pending", () => {
    queries.getTrackEntityById.mockReturnValue(new Promise(() => {}));

    renderPanel(payloadTrack());

    expect(screen.getByText("Portishead")).toBeInTheDocument();
  });
});
