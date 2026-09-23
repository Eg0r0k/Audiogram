import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "neverthrow";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { AlbumId, TrackId } from "@/types/ids";

vi.mock("@/db/storage", () => ({
  storageService: { listFiles: vi.fn(async () => ok([])), getFileSize: vi.fn(), deleteFile: vi.fn() },
}));
vi.mock("@/db/storage/IFileStorage", () => ({ hasNativeSupport: () => false }));
vi.mock("@/lib/environment/platformCaps", () => ({ platformCaps: { hasFs: false } }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => false }));

import { db } from "@/db";
import { collectStorageInfo } from "../storage-info.service";

const track = (id: string, pinned: 0 | 1): TrackEntity => ({
  id: TrackId(id),
  title: id,
  artistName: "",
  albumTitle: "",
  artistIds: [],
  albumId: AlbumId(""),
  tagIds: [],
  source: TrackSource.REMOTE_SUBSONIC,
  state: TrackState.READY,
  pinned,
  duration: 1,
  format: {},
  playCount: 0,
  addedAt: 1,
});

describe("collectStorageInfo counts", () => {
  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
  });

  it("counts library tracks only, not the shadow rows kept for history", async () => {
    await db.tracks.bulkAdd([track("local-1", 1), track("nd:s1", 1), track("nd:s2", 0), track("yt:v1", 0)]);

    const info = await collectStorageInfo();

    expect(info.tracksCount).toBe(2);
  });
});
