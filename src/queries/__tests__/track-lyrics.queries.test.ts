import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { okAsync } from "neverthrow";
import { QueryClient } from "@tanstack/vue-query";
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
import { mapTrack } from "@/types/track";
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

describe("track lyrics mutations (integration)", () => {
  let queryClient: QueryClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    storageMock.deleteFile.mockReturnValue(okAsync(undefined));
    queryClient = new QueryClient();
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
  });

  it("attaches lyrics with the picked file name", async () => {
    await db.tracks.put(trackRow({ lyricsOffsetMs: 900 }));
    const track = mapTrack(trackRow({ lyricsOffsetMs: 900 }));

    const next = await attachTrackLyricsAndSync(queryClient, track, {
      lyricsPath: "lyrics/t-1.lrc",
      lyricsFileName: "Song.lrc",
      lyricsOffsetMs: 0,
    });

    expect(next).toMatchObject({ lyricsPath: "lyrics/t-1.lrc", lyricsFileName: "Song.lrc", lyricsOffsetMs: 0 });
    expect(await db.tracks.get(trackId)).toMatchObject({ lyricsPath: "lyrics/t-1.lrc", lyricsFileName: "Song.lrc", lyricsOffsetMs: 0 });
  });

  it("detaches lyrics: clears path and file name and zeroes the offset", async () => {
    await db.tracks.put(withLyrics);
    const track = mapTrack(withLyrics);

    const next = await detachTrackLyricsAndSync(queryClient, track);

    expect(next.lyricsPath).toBeUndefined();
    expect(next.lyricsFileName).toBeUndefined();
    expect(next.lyricsOffsetMs).toBe(0);
    const stored = await db.tracks.get(trackId);
    expect(stored).not.toHaveProperty("lyricsPath");
    expect(stored).not.toHaveProperty("lyricsFileName");
    expect(stored).toHaveProperty("lyricsOffsetMs", 0);
  });

  it("detaching leaves the lyrics file in storage", async () => {
    await db.tracks.put(withLyrics);

    await detachTrackLyricsAndSync(queryClient, mapTrack(withLyrics));

    expect(await db.tracks.get(trackId)).not.toHaveProperty("lyricsPath");
    expect(storageMock.deleteFile).not.toHaveBeenCalled();
  });

  it("saves the lyrics offset", async () => {
    await db.tracks.put(withLyrics);
    const track = mapTrack(withLyrics);

    const next = await setTrackLyricsOffsetAndSync(queryClient, track, -750);

    expect(next).toMatchObject({ lyricsPath: "lyrics/t-1.lrc", lyricsFileName: "Song.lrc", lyricsOffsetMs: -750 });
    expect(await db.tracks.get(trackId)).toMatchObject({ lyricsPath: "lyrics/t-1.lrc", lyricsFileName: "Song.lrc", lyricsOffsetMs: -750 });
    expect(storageMock.deleteFile).not.toHaveBeenCalled();
  });
});
