import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TrackId } from "@/types/ids";

vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  exists: vi.fn(),
  mkdir: vi.fn(),
  BaseDirectory: { AppData: 1 },
}));

vi.mock("@tauri-apps/api/path", () => ({
  appDataDir: vi.fn().mockResolvedValue("C:/app"),
}));

vi.mock("@/lib/logger", () => ({ getLogger: () => ({ error: vi.fn() }) }));

const caps = { hasFs: true };
vi.mock("@/lib/environment/platformCaps", () => ({ platformCaps: caps }));

const fs = await import("@tauri-apps/plugin-fs");
const { loadFeedback, saveFeedback, pairKey, FEEDBACK_FILE } = await import("@/modules/recommendations/service/stand-feedback.store");

const mockRead = fs.readTextFile as ReturnType<typeof vi.fn>;
const mockWrite = fs.writeTextFile as ReturnType<typeof vi.fn>;
const mockExists = fs.exists as ReturnType<typeof vi.fn>;
const mockMkdir = fs.mkdir as ReturnType<typeof vi.fn>;
const tid = (s: string) => s as TrackId;

beforeEach(() => {
  vi.clearAllMocks();
  caps.hasFs = true;
  localStorage.clear();
  mockExists.mockResolvedValue(true);
});

describe("stand feedback store (tauri)", () => {
  it("returns an empty map when the file does not exist", async () => {
    mockExists.mockResolvedValue(false);
    expect((await loadFeedback()).size).toBe(0);
    expect(mockRead).not.toHaveBeenCalled();
  });

  it("reads entries keyed by pair", async () => {
    mockExists.mockResolvedValue(true);
    mockRead.mockResolvedValue(JSON.stringify({ version: 1, entries: [{ sourceId: "S", candidateId: "A", label: 1, at: 5 }] }));
    const map = await loadFeedback();
    expect(map.get(pairKey(tid("S"), tid("A")))?.label).toBe(1);
  });

  it("writes the whole file in AppData", async () => {
    await saveFeedback([{ sourceId: tid("S"), candidateId: tid("A"), label: -1, at: 1 }]);
    expect(mockWrite).toHaveBeenCalledWith(
      FEEDBACK_FILE,
      JSON.stringify({ version: 1, entries: [{ sourceId: "S", candidateId: "A", label: -1, at: 1 }] }),
      { baseDir: 1 },
    );
  });

  it("creates the app-data directory before writing when it does not exist yet", async () => {
    mockExists.mockResolvedValue(false);
    await saveFeedback([{ sourceId: tid("S"), candidateId: tid("A"), label: -1, at: 1 }]);
    expect(mockMkdir).toHaveBeenCalledWith("C:/app", { recursive: true });
    expect(mockMkdir.mock.invocationCallOrder[0]).toBeLessThan(mockWrite.mock.invocationCallOrder[0]);
  });

  it("returns an empty map on malformed json", async () => {
    mockExists.mockResolvedValue(true);
    mockRead.mockResolvedValue("{not json");
    expect((await loadFeedback()).size).toBe(0);
  });
});

describe("stand feedback store (web)", () => {
  it("round-trips through localStorage", async () => {
    caps.hasFs = false;
    await saveFeedback([{ sourceId: tid("S"), candidateId: tid("B"), label: 1, at: 2 }]);
    expect(mockWrite).not.toHaveBeenCalled();
    const map = await loadFeedback();
    expect(map.get(pairKey(tid("S"), tid("B")))?.label).toBe(1);
  });
});
