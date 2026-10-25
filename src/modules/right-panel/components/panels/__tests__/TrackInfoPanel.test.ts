import { fireEvent, render, screen } from "@testing-library/vue";
import { flushPromises } from "@vue/test-utils";
import { shownToasts } from "@/test/toasts";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import type { Track } from "@/types/track";
import TrackInfoPanel from "../TrackInfoPanel.vue";

const queries = vi.hoisted(() => ({ getTrackEntityById: vi.fn() }));
vi.mock("@/queries/track.queries", () => ({
  trackQueries: {
    detail: (id: string) => ({ queryKey: ["tracks", id], queryFn: () => queries.getTrackEntityById(id) }),
  },
}));
vi.mock("@/queries/localCopy.queries", async () => {
  const { skipToken } = await import("@tanstack/vue-query");
  return {
    localCopyQueries: {
      byRemoteId: () => ({ queryKey: ["tracks", "localCopy", "none"], queryFn: skipToken }),
    },
  };
});
const deletion = vi.hoisted(() => ({ deleteWithUndo: vi.fn() }));
vi.mock("@/modules/tracks/composables/useTrackDeletion", () => ({
  useTrackDeletion: () => deletion,
}));
vi.mock("@/app/toaster", () => ({ toaster: { add: vi.fn() } }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }) }));
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

  it("shows a failed delete under the delete button instead of a toast", async () => {
    queries.getTrackEntityById.mockReturnValue(new Promise(() => {}));
    deletion.deleteWithUndo.mockRejectedValueOnce(new Error("quota"));
    renderPanel(payloadTrack());

    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    const deleteButton = deleteButtons[deleteButtons.length - 1]!;
    await fireEvent.click(deleteButton);
    await flushPromises();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Failed to delete track");
    expect(deleteButton.nextElementSibling).toBe(alert);
    expect(shownToasts("destructive")).toHaveLength(0);
  });
});
