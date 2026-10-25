import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { okAsync } from "neverthrow";
import { QueryClient, type InfiniteData } from "@tanstack/vue-query";
import type { TrackEntity } from "@/db/entities";
import { TrackSource, TrackState } from "@/db/entities";
import { AlbumId, ArtistId, TrackId } from "@/types/ids";

const storageMock = vi.hoisted(() => ({ deleteFile: vi.fn() }));

vi.mock("@/db/storage", () => ({ storageService: storageMock }));
vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock("@/services/search/searchIndex", () => ({
  syncSearchIndex: vi.fn(async () => {}),
}));

import { db } from "@/db";
import { mapTrack, type Track } from "@/types/track";
import { queryKeys } from "../query-keys";
import type { PaginatedTracksResult } from "../types";
import {
  attachTrackLyricsAndSync,
  detachTrackLyricsAndSync,
  setTrackLyricsOffsetAndSync,
} from "../track.queries";

const trackId = TrackId("t-1");

const trackRow = (overrides: Partial<TrackEntity> = {}): TrackEntity => ({
  id: trackId,
  title: "Song",
  artistName: "Artist",
  albumTitle: "Album",
  artistIds: [ArtistId("a-1")],
  albumId: AlbumId("al-1"),
  tagIds: [],
  source: TrackSource.LOCAL_INTERNAL,
  storagePath: "tracks/t-1.mp3",
  pinned: 1,
  state: TrackState.READY,
  duration: 200,
  format: {},
  playCount: 0,
  addedAt: 1,
  ...overrides,
});

const withLyrics = trackRow({ lyricsPath: "lyrics/t-1.lrc", lyricsFileName: "Song.lrc", lyricsOffsetMs: 1500 });

const indexKey = queryKeys.tracks.indexInfinite(null, "");
const byIdsKey = queryKeys.tracks.byIds([trackId]);

const primeCaches = (queryClient: QueryClient, row: TrackEntity) => {
  const track = mapTrack(row);
  queryClient.setQueryData(queryKeys.tracks.detail(row.id), row);
  queryClient.setQueryData<InfiniteData<PaginatedTracksResult>>(indexKey, {
    pages: [{ tracks: [track], nextOffset: null, total: 1 }],
    pageParams: [0],
  });
  queryClient.setQueryData<Track[]>(byIdsKey, [track]);
  return track;
};

const cachedRows = (queryClient: QueryClient) => ({
  entity: queryClient.getQueryData<TrackEntity>(queryKeys.tracks.detail(trackId)),
  pageRow: queryClient.getQueryData<InfiniteData<PaginatedTracksResult>>(indexKey)?.pages[0].tracks[0],
  byIdsRow: queryClient.getQueryData<Track[]>(byIdsKey)?.[0],
});

describe("track lyrics mutations (integration)", () => {
  let queryClient: QueryClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    storageMock.deleteFile.mockReturnValue(okAsync(undefined));
    queryClient = new QueryClient();
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
  });

  it("attaches lyrics with the picked file name and patches the caches", async () => {
    await db.tracks.put(trackRow({ lyricsOffsetMs: 900 }));
    const track = primeCaches(queryClient, trackRow({ lyricsOffsetMs: 900 }));

    const next = await attachTrackLyricsAndSync(queryClient, track, {
      lyricsPath: "lyrics/t-1.lrc",
      lyricsFileName: "Song.lrc",
      lyricsOffsetMs: 0,
    });

    expect(next).toMatchObject({ lyricsPath: "lyrics/t-1.lrc", lyricsFileName: "Song.lrc", lyricsOffsetMs: 0 });
    expect(await db.tracks.get(trackId)).toMatchObject({ lyricsPath: "lyrics/t-1.lrc", lyricsFileName: "Song.lrc", lyricsOffsetMs: 0 });
    const { entity, pageRow, byIdsRow } = cachedRows(queryClient);
    expect(entity).toMatchObject({ lyricsPath: "lyrics/t-1.lrc", lyricsFileName: "Song.lrc", lyricsOffsetMs: 0 });
    expect(pageRow).toEqual(next);
    expect(byIdsRow).toEqual(next);
  });

  it("detaches lyrics: clears path and file name, zeroes the offset and patches the caches", async () => {
    await db.tracks.put(withLyrics);
    const track = primeCaches(queryClient, withLyrics);

    const next = await detachTrackLyricsAndSync(queryClient, track);

    expect(next.lyricsPath).toBeUndefined();
    expect(next.lyricsFileName).toBeUndefined();
    expect(next.lyricsOffsetMs).toBe(0);
    const stored = await db.tracks.get(trackId);
    expect(stored).not.toHaveProperty("lyricsPath");
    expect(stored).not.toHaveProperty("lyricsFileName");
    expect(stored).toHaveProperty("lyricsOffsetMs", 0);
    const { entity, pageRow, byIdsRow } = cachedRows(queryClient);
    expect(entity?.lyricsPath).toBeUndefined();
    expect(entity?.lyricsFileName).toBeUndefined();
    expect(entity?.lyricsOffsetMs).toBe(0);
    expect(pageRow).toEqual(next);
    expect(byIdsRow).toEqual(next);
  });

  it("detaching leaves the lyrics file in storage", async () => {
    await db.tracks.put(withLyrics);

    await detachTrackLyricsAndSync(queryClient, mapTrack(withLyrics));

    expect(await db.tracks.get(trackId)).not.toHaveProperty("lyricsPath");
    expect(storageMock.deleteFile).not.toHaveBeenCalled();
  });

  it("saves the lyrics offset and patches the caches", async () => {
    await db.tracks.put(withLyrics);
    const track = primeCaches(queryClient, withLyrics);

    const next = await setTrackLyricsOffsetAndSync(queryClient, track, -750);

    expect(next).toMatchObject({ lyricsPath: "lyrics/t-1.lrc", lyricsFileName: "Song.lrc", lyricsOffsetMs: -750 });
    expect(await db.tracks.get(trackId)).toMatchObject({ lyricsPath: "lyrics/t-1.lrc", lyricsFileName: "Song.lrc", lyricsOffsetMs: -750 });
    const { entity, pageRow, byIdsRow } = cachedRows(queryClient);
    expect(entity?.lyricsOffsetMs).toBe(-750);
    expect(pageRow).toEqual(next);
    expect(byIdsRow).toEqual(next);
    expect(storageMock.deleteFile).not.toHaveBeenCalled();
  });
});
