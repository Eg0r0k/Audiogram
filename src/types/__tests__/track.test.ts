import { describe, expect, it } from "vitest";
import { TrackSource, TrackState, type AlbumEntity, type ArtistEntity, type TrackEntity } from "@/db/entities";
import { AlbumId, ArtistId, TrackId } from "@/types/ids";
import { mapTrack, mapTracks } from "../track";

const entity = (overrides: Partial<TrackEntity> = {}): TrackEntity => ({
  id: TrackId("nd:song1"),
  title: "Song",
  artistName: "Artist A, Artist B",
  albumTitle: "",
  artistIds: [ArtistId("local-a"), ArtistId("nd:b")],
  albumId: AlbumId(""),
  tagIds: [],
  source: TrackSource.REMOTE_SUBSONIC,
  state: TrackState.READY,
  pinned: 0,
  duration: 1,
  format: {},
  playCount: 0,
  addedAt: 1,
  ...overrides,
});

const artist = (id: string, name: string): ArtistEntity =>
  ({ id: ArtistId(id), name, pinned: 1, addedAt: 1, updatedAt: 1 });

const album = (id: string, title: string): AlbumEntity =>
  ({ id: AlbumId(id), title, artistId: ArtistId("local-a"), pinned: 1, addedAt: 1, updatedAt: 1 });

describe("mapTrack artist caption", () => {
  it("takes the names from the artist rows when every artist has one", () => {
    const track = mapTrack(entity(), [artist("local-a", "Renamed A"), artist("nd:b", "Renamed B")], null);

    expect(track.artist).toBe("Renamed A, Renamed B");
  });

  it("keeps the track's own caption when only some artists have a row", () => {
    const track = mapTrack(entity(), [artist("local-a", "Artist A")], null);

    expect(track.artist).toBe("Artist A, Artist B");
  });

  it("mapTracks applies the same rule per track", () => {
    const [track] = mapTracks([entity()], [artist("local-a", "Artist A")], []);

    expect(track?.artist).toBe("Artist A, Artist B");
  });
});

describe("mapTrack", () => {
  it("maps an entity alone the way a restored queue entry needs it", () => {
    const row = entity({
      id: TrackId("local-1"),
      albumTitle: "Stored Album",
      albumId: AlbumId("album-1"),
      source: TrackSource.LOCAL_INTERNAL,
      storagePath: "tracks/local-1.flac",
      pinned: 1,
      duration: 245,
      likedAt: 10,
      playCount: 7,
      addedAt: 3,
      trackNo: 4,
      diskNo: 2,
      lyricsPath: "lyrics/local-1.lrc",
      lyricsFileName: "song.lrc",
      lyricsOffsetMs: -150,
      integratedLufs: -9.5,
      truePeakDbtp: -0.4,
      replayGainDb: -4.5,
      replayPeak: 0.98,
    });

    expect(mapTrack(row)).toEqual({
      kind: "library",
      id: TrackId("local-1"),
      title: "Song",
      artist: "Artist A, Artist B",
      artistIds: [ArtistId("local-a"), ArtistId("nd:b")],
      albumId: AlbumId("album-1"),
      albumName: "Stored Album",
      storagePath: "tracks/local-1.flac",
      source: TrackSource.LOCAL_INTERNAL,
      state: TrackState.READY,
      pinned: 1,
      duration: 245,
      isLiked: true,
      playCount: 7,
      addedAt: 3,
      trackNo: 4,
      diskNo: 2,
      lyricsPath: "lyrics/local-1.lrc",
      lyricsFileName: "song.lrc",
      lyricsOffsetMs: -150,
      integratedLufs: -9.5,
      truePeakDbtp: -0.4,
      replayGainDb: -4.5,
      replayPeak: 0.98,
    });
  });

  it("takes artist and album names from their rows when every artist row is present", () => {
    const row = entity({ albumId: AlbumId("album-1"), albumTitle: "Stored Album" });

    const [track] = mapTracks(
      [row],
      [artist("nd:b", "Row B"), artist("other", "Other"), artist("local-a", "Row A")],
      [album("other", "Other Album"), album("album-1", "Row Album")],
    );

    expect(track?.artist).toBe("Row A, Row B");
    expect(track?.albumName).toBe("Row Album");
  });

  it("falls back to the stored artist caption when an artist row is missing", () => {
    const row = entity({ albumId: AlbumId("album-1"), albumTitle: "Stored Album" });

    const track = mapTrack(row, [artist("nd:b", "Row B")], album("album-1", "Row Album"));

    expect(track.artist).toBe("Artist A, Artist B");
    expect(track.albumName).toBe("Row Album");
  });
});
