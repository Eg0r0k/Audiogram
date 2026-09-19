import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ndAlbumId, ndArtistId, ndTrackId } from "@/types/track-ref";
import type { SourceTrackDTO } from "@/modules/sources";
import type { ArtistEntity } from "@/db/entities";
import type { ArtistId } from "@/types/ids";
import { measureRecordReads } from "@/test/idb-meter";

vi.mock("@/modules/search/service/searchIndex", () => ({
  indexImportedTracks: vi.fn(async () => {}),
}));
vi.mock("../shadowAlbumCover", () => ({ ensureShadowCover: vi.fn(async () => {}) }));
vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

import { err } from "neverthrow";
import { db } from "@/db";
import { trackRepository } from "@/db/repositories";
import { ensurePinnedMany } from "../ensurePinned";

//
// Queueing a remote album shadow-pins every one of its tracks. Done one at a
// time each pin re-reads the whole artists table to match names against the
// local library, which turns "play this album" into O(tracks × artists).
//

const ARTISTS = 200;
const TRACKS = 50;

const artist = (index: number): ArtistEntity => ({
  id: `local-ar-${index}` as ArtistId,
  name: `Artist ${index}`,
  pinned: 1,
  addedAt: 1,
  updatedAt: 1,
});

const dto = (index: number): SourceTrackDTO => ({
  id: ndTrackId(`song${index}`),
  title: `Remote Song ${index}`,
  artistName: `Artist ${index % ARTISTS}`,
  albumTitle: "Remote Album",
  albumId: ndAlbumId("album1"),
  artistIds: [ndArtistId(`artist${index % ARTISTS}`)],
  duration: 240,
});

const subjects = Array.from({ length: TRACKS }, (_, i) => ({
  kind: "remote" as const,
  dto: dto(i),
}));

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map(table => table.clear()));
  await db.artists.bulkPut(Array.from({ length: ARTISTS }, (_, i) => artist(i)));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ensurePinnedMany", () => {
  it("writes a shadow row for every subject", async () => {
    const pinned = await ensurePinnedMany(subjects, { pinned: 0 });

    expect(pinned).toHaveLength(TRACKS);
    expect(await db.tracks.count()).toBe(TRACKS);
    expect((await db.tracks.toArray()).every(track => track.pinned === 0)).toBe(true);
  });

  it("matches a remote artist onto the same-named local row", async () => {
    await ensurePinnedMany([subjects[0]], { pinned: 0 });

    const track = await db.tracks.get(ndTrackId("song0"));
    expect(track?.artistIds).toEqual(["local-ar-0"]);
  });

  it("pins the rest of the batch when one subject cannot be written", async () => {
    const write = trackRepository.upsert.bind(trackRepository);
    const doomed = ndTrackId("song30");
    vi.spyOn(trackRepository, "upsert").mockImplementation(track =>
      track.id === doomed
        ? Promise.resolve(err(new Error("DataCloneError")))
        : write(track),
    );

    const pinned = await ensurePinnedMany(subjects, { pinned: 0 });

    expect(pinned).toHaveLength(TRACKS - 1);
    expect(await db.tracks.count()).toBe(TRACKS - 1);
    expect(await db.tracks.get(doomed)).toBeUndefined();
  });

  it("rejects when its only subject cannot be written", async () => {
    vi.spyOn(trackRepository, "upsert").mockResolvedValue(err(new Error("DataCloneError")));

    await expect(ensurePinnedMany([subjects[0]], { pinned: 0 })).rejects.toThrow("DataCloneError");
  });

  it("reads the artists table once for the whole batch", async () => {
    const { valueReads } = await measureRecordReads(() =>
      ensurePinnedMany(subjects, { pinned: 0 }),
    );

    // One pass over the artists, plus the few rows each subject looks up.
    expect(valueReads).toBeLessThan(ARTISTS * 2);
  });
});
