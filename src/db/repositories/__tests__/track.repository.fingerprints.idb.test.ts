import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrackEntity } from "@/db/entities";
import { TrackSource, TrackState } from "@/db/entities";
import { AlbumId, TrackId } from "@/types/ids";

vi.mock("@/db/storage", () => ({ storageService: { deleteFile: vi.fn() } }));
vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

import { db } from "@/db";
import { trackRepository } from "../track.repository";

const track = (id: string, fingerprint?: string): TrackEntity => ({
  id: TrackId(id),
  title: id,
  artistIds: [],
  albumId: AlbumId(""),
  tagIds: [],
  source: TrackSource.LOCAL,
  state: TrackState.READY,
  duration: 1,
  format: {},
  playCount: 0,
  addedAt: 1,
  albumTitle: "",
  artistName: "",
  pinned: 1,
  fingerprint,
} as unknown as TrackEntity);

describe("trackRepository.findExistingFingerprints (idb)", () => {
  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const spyCursorReads = () => {
    const proto = Object.getPrototypeOf(db.tracks.toCollection()) as Record<string, () => unknown>;
    return [vi.spyOn(proto, "uniqueKeys"), vi.spyOn(proto, "keys"), vi.spyOn(proto, "each")];
  };

  it("returns the candidates the library already holds", async () => {
    await db.tracks.bulkPut([track("t-1", "fp-a"), track("t-2", "fp-b"), track("t-3")]);

    const found = await trackRepository.findExistingFingerprints(["fp-a", "fp-c", "fp-a"]);

    expect(found._unsafeUnwrap()).toEqual(new Set(["fp-a"]));
  });

  it("answers an empty library with an empty set", async () => {
    const found = await trackRepository.findExistingFingerprints(["fp-a"]);

    expect(found._unsafeUnwrap()).toEqual(new Set());
  });

  it("looks candidates up without walking a cursor", async () => {
    await db.tracks.bulkPut([track("t-1", "fp-a")]);
    const spies = spyCursorReads();

    await trackRepository.findExistingFingerprints(["fp-a", "fp-b"]);

    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});
