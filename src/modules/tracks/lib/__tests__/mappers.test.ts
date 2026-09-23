import { describe, expect, it } from "vitest";
import { TrackSource, TrackState, type ArtistEntity, type TrackEntity } from "@/db/entities";
import { AlbumId, ArtistId, TrackId } from "@/types/ids";
import { mapTrack, mapTracks } from "../mappers";

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
