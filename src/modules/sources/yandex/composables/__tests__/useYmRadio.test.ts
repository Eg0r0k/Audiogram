import { beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok } from "neverthrow";
import { shownToasts } from "@/test/toasts";

const queue = vi.hoisted(() => ({ startRadio: vi.fn(), isRadio: false }));

vi.mock("@/modules/queue/store/queue.store", () => ({ useQueueStore: () => queue }));
vi.mock("../../radio/radio-session", () => ({
  MY_WAVE_STATION: "user:onyourwave",
  createYmRadioSession: (station: string) => ({ station }),
}));
vi.mock("@/app/toaster", () => ({ toaster: { add: vi.fn() } }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/app/i18n", () => ({ i18n: { global: { t: (key: string) => key } } }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ warn: vi.fn(), error: vi.fn() }) }));

import { useYmRadio } from "../useYmRadio";

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe("useYmRadio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queue.startRadio.mockReset();
  });

  it("offers a retry that starts the same station again", async () => {
    queue.startRadio
      .mockResolvedValueOnce(err({ kind: "NETWORK", message: "offline" }))
      .mockResolvedValueOnce(ok(undefined));
    const { start } = useYmRadio();
    await start("genre:rock");

    const [failure] = shownToasts("destructive");
    expect(failure?.title).toBe("queue.radioFailed");
    failure?.actions?.[0]?.onClick?.(new MouseEvent("click"));
    await flush();

    expect(queue.startRadio).toHaveBeenCalledTimes(2);
    expect(queue.startRadio).toHaveBeenLastCalledWith({ station: "genre:rock" });
  });

  it("offers no retry when the account has no access to the station", async () => {
    queue.startRadio.mockResolvedValueOnce(err({ kind: "FORBIDDEN", message: "no plus" }));
    const { start } = useYmRadio();
    await start();

    const [failure] = shownToasts("destructive");
    expect(failure?.title).toBe("settings.sources.ym.stationNeedsPlus");
    expect(failure?.actions).toBeUndefined();
  });
});
