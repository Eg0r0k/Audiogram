import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrackEntity } from "@/db/entities";
import { TrackSource, TrackState } from "@/db/entities";
import { AlbumId, ArtistId, TrackId } from "@/types/ids";
import { ymAlbumId, ymArtistId, ymTrackId } from "@/types/track-ref";

vi.mock("@/db/storage", () => ({ storageService: { deleteFile: vi.fn() } }));
vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

import { db } from "@/db";
import { trackRepository } from "../track.repository";

const ALBUM = ymAlbumId("9");

const row = (id: TrackId, pinned: 0 | 1, extra: Partial<TrackEntity> = {}): TrackEntity => ({
  id,
  title: id,
  artistName: "УННВ",
  albumTitle: "Неизданное",
  artistIds: [ymArtistId("5")] as ArtistId[],
  albumId: ALBUM as AlbumId,
  tagIds: [],
  source: pinned === 1 ? TrackSource.LOCAL_INTERNAL : TrackSource.REMOTE_YM,
  pinned,
  state: TrackState.READY,
  storagePath: pinned === 1 ? `tracks/${id}.mp3` : "",
  duration: 100,
  format: {},
  playCount: 0,
  addedAt: 1,
  trackNo: 1,
  ...extra,
});

//
// A liked catalog track (shadow, pinned = 0) and its downloaded local copy
// share the album row — the album page must list the copy once, not both.
//
describe("album listings skip shadow rows (idb)", () => {
  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    await db.tracks.bulkPut([
      row(ymTrackId("b"), 0, { likedAt: 5 }),
      row(TrackId("local-b"), 1, { sourceRef: ymTrackId("b") }),
      row(ymTrackId("c"), 0, { trackNo: 2 }),
    ]);
  });

  it("findByAlbumIdPaginated lists library members only", async () => {
    const page = await trackRepository.findByAlbumIdPaginated(ALBUM, 0, 10);
    expect(page._unsafeUnwrap().map(track => track.id)).toEqual([TrackId("local-b")]);
  });

  it("countByAlbumId and sumDurationByAlbumId count library members only", async () => {
    expect((await trackRepository.countByAlbumId(ALBUM))._unsafeUnwrap()).toBe(1);
    expect((await trackRepository.sumDurationByAlbumId(ALBUM))._unsafeUnwrap()).toBe(100);
  });

  it("findByAlbumId still returns every row for the cascades", async () => {
    const all = await trackRepository.findByAlbumId(ALBUM);
    expect(all._unsafeUnwrap()).toHaveLength(3);
  });
});
