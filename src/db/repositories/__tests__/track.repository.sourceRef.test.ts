import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import type { TrackEntity } from "@/db/entities";
import { TrackSource, TrackState } from "@/db/entities";
import { trackRepository } from "@/db/repositories";
import { AlbumId, TrackId } from "@/types/ids";
import { ymTrackId } from "@/types/track-ref";

const localTrack = (id: string, sourceRef?: TrackId): TrackEntity => ({
  id: TrackId(id),
  title: id,
  artistName: "",
  albumTitle: "",
  artistIds: [],
  albumId: AlbumId(""),
  tagIds: [],
  source: TrackSource.LOCAL_INTERNAL,
  pinned: 1 as const,
  state: TrackState.READY,
  storagePath: `tracks/${id}.mp3`,
  duration: 1,
  format: {},
  playCount: 0,
  addedAt: 1,
  sourceRef,
});

describe("trackRepository.findBySourceRef", () => {
  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
  });

  it("finds the local track downloaded from a remote id", async () => {
    await db.tracks.bulkAdd([localTrack("a"), localTrack("b", ymTrackId("123"))]);

    const result = await trackRepository.findBySourceRef(ymTrackId("123"));

    expect(result._unsafeUnwrap()?.id).toBe("b");
  });

  it("returns undefined for a remote id nothing was downloaded from", async () => {
    await db.tracks.bulkAdd([localTrack("a"), localTrack("b", ymTrackId("123"))]);

    const result = await trackRepository.findBySourceRef(ymTrackId("999"));

    expect(result._unsafeUnwrap()).toBeUndefined();
  });

  it("ignores rows without sourceRef", async () => {
    await db.tracks.bulkAdd([localTrack("a")]);

    const result = await trackRepository.findBySourceRef(ymTrackId("a"));

    expect(result._unsafeUnwrap()).toBeUndefined();
  });
});
