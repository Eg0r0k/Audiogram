import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackId } from "@/types/ids";
import { shownToasts } from "@/test/toasts";

const undoApi = vi.hoisted(() => ({
  deleteTracksWithUndo: vi.fn(),
  restore: vi.fn(async () => {}),
  finalize: vi.fn(async () => {}),
}));
const queue = vi.hoisted(() => ({
  queue: [] as { id: string; track: { id: string } }[],
  removeMultiple: vi.fn(async () => {}),
}));

vi.mock("@/queries/track-undo", () => ({ deleteTracksWithUndo: undoApi.deleteTracksWithUndo }));
vi.mock("@/app/toaster", () => ({ toaster: { add: vi.fn() } }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/app/i18n", () => ({ i18n: { global: { t: (key: string) => key } } }));
vi.mock("@tanstack/vue-query", () => ({ useQueryClient: () => ({ tag: "qc" }) }));
vi.mock("@/modules/queue/store/queue.store", () => ({ useQueueStore: () => queue }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ warn: vi.fn(), error: vi.fn() }) }));

import { useTrackDeletion } from "../useTrackDeletion";

type UndoToast = {
  actions: [{ label: string; onClick: () => void }];
  onClose: () => void;
};

const lastToastOptions = () => shownToasts("success").at(-1) as unknown as UndoToast;
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe("useTrackDeletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queue.queue = [];
    undoApi.deleteTracksWithUndo.mockResolvedValue({ deleted: 2, restore: undoApi.restore, finalize: undoApi.finalize });
  });

  it("deletes, drops queue entries and shows a toast with an undo action", async () => {
    queue.queue = [{ id: "q1", track: { id: "t1" } }, { id: "q2", track: { id: "other" } }];

    const deleted = await useTrackDeletion().deleteWithUndo([TrackId("t1"), TrackId("t2")], count => `deleted:${count}`);

    expect(deleted).toBe(2);
    expect(undoApi.deleteTracksWithUndo).toHaveBeenCalledWith({ tag: "qc" }, ["t1", "t2"]);
    expect(queue.removeMultiple).toHaveBeenCalledWith(["q1"]);
    expect(shownToasts("success")).toContainEqual(expect.objectContaining({
      title: "deleted:2",
      actions: [expect.objectContaining({ label: "common.undo" })],
    }));
  });

  it("undo restores and skips finalize even when the toast dismisses afterwards", async () => {
    await useTrackDeletion().deleteWithUndo([TrackId("t1")], () => "deleted");
    const options = lastToastOptions();

    options.actions[0].onClick();
    options.onClose();
    await flush();

    expect(undoApi.restore).toHaveBeenCalledTimes(1);
    expect(undoApi.finalize).not.toHaveBeenCalled();
  });

  it("finalizes once the toast closes on its own", async () => {
    await useTrackDeletion().deleteWithUndo([TrackId("t1")], () => "deleted");

    lastToastOptions().onClose();
    await flush();

    expect(undoApi.finalize).toHaveBeenCalledTimes(1);
    expect(undoApi.restore).not.toHaveBeenCalled();
  });

  it("reports a failed restore", async () => {
    undoApi.restore.mockRejectedValueOnce(new Error("boom"));
    await useTrackDeletion().deleteWithUndo([TrackId("t1")], () => "deleted");

    lastToastOptions().actions[0].onClick();
    await flush();

    expect(shownToasts("destructive")).toContainEqual(expect.objectContaining({ title: "track.restoreFailed" }));
  });

  it("shows nothing when no track was deleted", async () => {
    undoApi.deleteTracksWithUndo.mockResolvedValue({ deleted: 0, restore: undoApi.restore, finalize: undoApi.finalize });

    const deleted = await useTrackDeletion().deleteWithUndo([TrackId("nope")], () => "deleted");

    expect(deleted).toBe(0);
    expect(shownToasts("success")).toHaveLength(0);
    expect(queue.removeMultiple).not.toHaveBeenCalled();
  });
});
