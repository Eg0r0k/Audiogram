import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackId } from "@/types/ids";
import type { SourceTrackDTO } from "@/modules/sources/types";
import { downloadSubject } from "../service/enqueue";
import { downloadDtoWithFeedback } from "../downloadFeedback";
import { shownToasts } from "@/test/toasts";

vi.mock("../service/enqueue", () => ({
  downloadSubject: vi.fn(),
}));

vi.mock("@/app/toaster", () => ({ toaster: { add: vi.fn() } }));

vi.mock("@/app/i18n", () => ({
  i18n: { global: { t: (key: string) => key } },
}));

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

const dto: SourceTrackDTO = { id: TrackId("yt:abc123def45"), title: "T" };

describe("downloadDtoWithFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stays quiet when a job is queued", async () => {
    vi.mocked(downloadSubject).mockResolvedValue("job-1");
    await downloadDtoWithFeedback(dto);
    expect(shownToasts("info")).toHaveLength(0);
    expect(shownToasts("destructive")).toHaveLength(0);
  });

  it("acknowledges an already-downloaded track", async () => {
    vi.mocked(downloadSubject).mockResolvedValue(null);
    await downloadDtoWithFeedback(dto);
    expect(shownToasts("info")).toContainEqual(expect.objectContaining({ title: "downloads.done" }));
  });

  it("reports a failure instead of throwing", async () => {
    vi.mocked(downloadSubject).mockRejectedValue(new Error("boom"));
    await expect(downloadDtoWithFeedback(dto)).resolves.toBeUndefined();
    expect(shownToasts("destructive")).toContainEqual(expect.objectContaining({ title: "downloads.enqueueFailed" }));
  });

  it("offers a retry that queues the same track again", async () => {
    vi.mocked(downloadSubject).mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("job-1");
    await downloadDtoWithFeedback(dto);

    const [failure] = shownToasts("destructive");
    expect(failure?.actions?.[0]?.label).toBe("common.retry");
    failure?.actions?.[0]?.onClick?.(new MouseEvent("click"));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(downloadSubject).toHaveBeenCalledTimes(2);
    expect(downloadSubject).toHaveBeenLastCalledWith({ kind: "remote", dto });
  });
});
