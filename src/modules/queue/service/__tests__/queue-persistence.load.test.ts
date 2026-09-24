import { ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QueueItemId } from "@/types/ids";

vi.mock("@/db/repositories", () => ({
  playlistRepository: {},
  trackRepository: {},
  queueSnapshotRepository: { get: vi.fn() },
}));
vi.mock("@/modules/player/utils/trackEntity", () => ({ mapTrackEntityToPlayerTrack: (e: unknown) => e }));
vi.mock("@/lib/stream-url", () => ({ migrateProxyUrl: (url: string) => url }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ warn: vi.fn(), error: vi.fn() }) }));

import { queueSnapshotRepository } from "@/db/repositories";
import { loadPersistedQueue, type PersistedQueueSnapshot } from "../queue-persistence";

const id = (value: string) => value as QueueItemId;

const STORED: PersistedQueueSnapshot = {
  version: 1,
  queue: ["a", "b", "c"].map(value => ({
    id: id(value),
    track: { kind: "library", trackId: value as never },
    source: { type: "manual" },
    addedAt: 0,
  })),
  originalQueueOrder: [id("a"), id("b"), id("c")],
  currentIndex: 0,
  currentItemId: id("a"),
  isShuffled: false,
};

describe("loadPersistedQueue", () => {
  beforeEach(() => {
    vi.mocked(queueSnapshotRepository.get).mockResolvedValue(ok(STORED));
  });

  // The cursor is written on every skip, the snapshot only on edits.
  it("takes the current entry from the cursor", async () => {
    const snapshot = await loadPersistedQueue({ currentItemId: id("c") });
    expect(snapshot).toMatchObject({ currentIndex: 2, currentItemId: "c" });
  });

  it("keeps the snapshot's own entry when the cursor names one it lacks", async () => {
    const snapshot = await loadPersistedQueue({ currentItemId: id("gone") });
    expect(snapshot).toMatchObject({ currentIndex: 0, currentItemId: "a" });
  });

  it("restores nothing as current when the cursor says nothing was", async () => {
    const snapshot = await loadPersistedQueue({ currentItemId: null });
    expect(snapshot).toMatchObject({ currentIndex: -1, currentItemId: undefined });
  });

  it("uses the snapshot as stored without a cursor", async () => {
    expect(await loadPersistedQueue(null)).toBe(STORED);
  });

  it("hands an unknown snapshot version back unread", async () => {
    const future = { version: 2, rows: [] };
    vi.mocked(queueSnapshotRepository.get).mockResolvedValue(ok(future));
    expect(await loadPersistedQueue({ currentItemId: id("a") })).toBe(future);
  });
});
