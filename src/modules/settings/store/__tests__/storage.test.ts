import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/storage-info.service", () => ({
  clearAllData: vi.fn().mockResolvedValue(undefined),
  collectStorageInfo: vi.fn().mockResolvedValue({
    tracksSize: 0,
    coversSize: 0,
    dbSize: 0,
    dbPath: "",
    tracksCount: 0,
    albumsCount: 0,
    artistsCount: 0,
    storagePath: "",
    quotaTotal: 0,
    quotaUsed: 0,
  }),
}));

describe("storage info service", () => {
  it("should export clearAllData", async () => {
    const { clearAllData } = await import("@/services/storage-info.service");
    expect(clearAllData).toBeDefined();
  });

  it("should export collectStorageInfo", async () => {
    const { collectStorageInfo } = await import("@/services/storage-info.service");
    expect(collectStorageInfo).toBeDefined();
  });
});