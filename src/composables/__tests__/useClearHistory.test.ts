import { beforeEach, describe, expect, it, vi } from "vitest";
import { shownToasts } from "@/test/toasts";

const dialog = vi.hoisted(() => ({ summonDialog: vi.fn() }));
const stats = vi.hoisted(() => ({ clearHistory: vi.fn(async () => {}) }));
const model = vi.hoisted(() => ({ clearModel: vi.fn(async () => {}) }));

vi.mock("@/components/dialogs/summonDialog", () => dialog);
vi.mock("@/services/stats.service", () => ({ statsService: stats }));
vi.mock("@/modules/recommendations/service/recommender-model.service", () => model);
vi.mock("@/app/toaster", () => ({ toaster: { add: vi.fn() } }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ error: vi.fn(), warn: vi.fn() }) }));

import { useClearHistory } from "../useClearHistory";

type WipeProps = { failedText: string; run: () => Promise<void> };
const summonedProps = () => dialog.summonDialog.mock.calls[0]?.[1] as WipeProps;

describe("useClearHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks through the wipe dialog, which shows its own failure next to the button", async () => {
    dialog.summonDialog.mockResolvedValue(undefined);

    await useClearHistory().clearHistory();

    expect(dialog.summonDialog).toHaveBeenCalledWith("confirmWipe", expect.objectContaining({
      title: "settings.stats.clearDialogTitle",
      failedText: "settings.stats.clearFailed",
    }), { key: "clear-history" });
  });

  it("clears the history and the model fitted on it, and lets a failure reach the dialog", async () => {
    dialog.summonDialog.mockResolvedValue(undefined);
    await useClearHistory().clearHistory();
    stats.clearHistory.mockRejectedValueOnce(new Error("quota"));

    await expect(summonedProps().run()).rejects.toThrow("quota");
    expect(shownToasts("destructive")).toHaveLength(0);

    await summonedProps().run();
    expect(model.clearModel).toHaveBeenCalledTimes(1);
  });

  it("confirms a finished wipe with a toast", async () => {
    dialog.summonDialog.mockResolvedValue(true);

    await expect(useClearHistory().clearHistory()).resolves.toBe(true);

    expect(shownToasts("success")).toContainEqual(expect.objectContaining({ title: "settings.stats.cleared" }));
  });
});
