import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackId } from "@/types/ids";

const undoApi = vi.hoisted(() => ({
  deleteTracksWithUndo: vi.fn(),
  restore: vi.fn(async () => {}),
  finalize: vi.fn(async () => {}),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const queue = vi.hoisted(() => ({
  queue: [] as { id: string; track: { id: string } }[],
  removeMultiple: vi.fn(async () => {}),
}));

const dialog = vi.hoisted(() => ({ summonDialog: vi.fn() }));
const settings = vi.hoisted(() => ({
  confirmTrackDeletion: { value: true },
  setConfirmTrackDeletion: vi.fn(),
}));

vi.mock("@/queries/track-undo", () => ({ deleteTracksWithUndo: undoApi.deleteTracksWithUndo }));
vi.mock("@/components/dialogs/summonDialog", () => dialog);
vi.mock("@/modules/settings/store/general", () => ({ useGeneralSettings: () => settings }));
vi.mock("vue-sonner", () => ({ toast }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@tanstack/vue-query", () => ({ useQueryClient: () => ({ tag: "qc" }) }));
vi.mock("@/modules/queue/store/queue.store", () => ({ useQueueStore: () => queue }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ warn: vi.fn(), error: vi.fn() }) }));

import { useTrackDeletion } from "../useTrackDeletion";

type ToastOptions = {
  duration: number;
  action: { label: string; onClick: () => void };
  onAutoClose: () => void;
  onDismiss: () => void;
};

const lastToastOptions = () => toast.success.mock.calls.at(-1)![1] as ToastOptions;
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe("useTrackDeletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settings.confirmTrackDeletion.value = true;
    queue.queue = [];
    undoApi.deleteTracksWithUndo.mockResolvedValue({ deleted: 2, restore: undoApi.restore, finalize: undoApi.finalize });
  });

  describe("confirmDeletion", () => {
    it("skips every dialog when the setting is off", async () => {
      settings.confirmTrackDeletion.value = false;

      await expect(useTrackDeletion().confirmDeletion([TrackId("t1")], "One")).resolves.toBe(true);
      await expect(useTrackDeletion().confirmDeletion([TrackId("t1"), TrackId("t2")])).resolves.toBe(true);
      expect(dialog.summonDialog).not.toHaveBeenCalled();
    });

    it("asks by name for a single row and honours don't-ask-again", async () => {
      dialog.summonDialog.mockResolvedValue({ dontAskAgain: true });

      await expect(useTrackDeletion().confirmDeletion([TrackId("t1")], "One")).resolves.toBe(true);

      expect(dialog.summonDialog).toHaveBeenCalledWith("deleteTrack", { trackTitle: "One" }, { key: "delete-track:t1" });
      expect(settings.setConfirmTrackDeletion).toHaveBeenCalledWith(false);
    });

    it("asks by count for a batch and reports a dismissed dialog", async () => {
      dialog.summonDialog.mockResolvedValue(undefined);

      await expect(useTrackDeletion().confirmDeletion([TrackId("t1"), TrackId("t2")])).resolves.toBe(false);

      expect(dialog.summonDialog).toHaveBeenCalledWith("deleteTracks", { count: 2 }, { key: "delete-tracks" });
      expect(settings.setConfirmTrackDeletion).not.toHaveBeenCalled();
    });
  });

  it("deletes, drops queue entries and shows a toast with an undo action", async () => {
    queue.queue = [{ id: "q1", track: { id: "t1" } }, { id: "q2", track: { id: "other" } }];

    const deleted = await useTrackDeletion().deleteWithUndo([TrackId("t1"), TrackId("t2")], count => `deleted:${count}`);

    expect(deleted).toBe(2);
    expect(undoApi.deleteTracksWithUndo).toHaveBeenCalledWith({ tag: "qc" }, ["t1", "t2"]);
    expect(queue.removeMultiple).toHaveBeenCalledWith(["q1"]);
    expect(toast.success).toHaveBeenCalledWith("deleted:2", expect.objectContaining({
      action: expect.objectContaining({ label: "common.undo" }),
    }));
  });

  it("undo restores and skips finalize even when the toast dismisses afterwards", async () => {
    await useTrackDeletion().deleteWithUndo([TrackId("t1")], () => "deleted");
    const options = lastToastOptions();

    options.action.onClick();
    options.onDismiss();
    await flush();

    expect(undoApi.restore).toHaveBeenCalledTimes(1);
    expect(undoApi.finalize).not.toHaveBeenCalled();
  });

  it("finalizes once the toast closes on its own", async () => {
    await useTrackDeletion().deleteWithUndo([TrackId("t1")], () => "deleted");

    lastToastOptions().onAutoClose();
    await flush();

    expect(undoApi.finalize).toHaveBeenCalledTimes(1);
    expect(undoApi.restore).not.toHaveBeenCalled();
  });

  it("reports a failed restore", async () => {
    undoApi.restore.mockRejectedValueOnce(new Error("boom"));
    await useTrackDeletion().deleteWithUndo([TrackId("t1")], () => "deleted");

    lastToastOptions().action.onClick();
    await flush();

    expect(toast.error).toHaveBeenCalledWith("track.restoreFailed");
  });

  it("shows nothing when no track was deleted", async () => {
    undoApi.deleteTracksWithUndo.mockResolvedValue({ deleted: 0, restore: undoApi.restore, finalize: undoApi.finalize });

    const deleted = await useTrackDeletion().deleteWithUndo([TrackId("nope")], () => "deleted");

    expect(deleted).toBe(0);
    expect(toast.success).not.toHaveBeenCalled();
    expect(queue.removeMultiple).not.toHaveBeenCalled();
  });
});
