import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "neverthrow";
import type { AlbumEntity, ArtistEntity, TrackEntity } from "@/db/entities";
import type { AlbumId, ArtistId, TrackId } from "@/types/ids";

const repositories = vi.hoisted(() => ({
  albumRepository: {
    findAllSortedByTitle: vi.fn(),
    findByIds: vi.fn(),
  },
  artistRepository: {
    findByIds: vi.fn(),
  },
  trackRepository: {
    findByAlbumId: vi.fn(),
    findSortedByIds: vi.fn(),
    countAll: vi.fn(),
    sumDurationAll: vi.fn(),
  },
}));

vi.mock("@/db/repositories", () => repositories);
vi.mock("@/modules/search/searchIndex", () => ({
  searchTracks: vi.fn(),
  upsertSearchDocuments: vi.fn(),
}));

import { getTracksIndexPageData } from "../track.queries";

describe("track.queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tracks in Dexie album order for album_asc", async () => {
    const albumB: AlbumEntity = {
      id: "album-b" as AlbumId,
      title: "B Album",
      artistId: "artist-1" as ArtistId,
      addedAt: 1,
      updatedAt: 1,
    };

    const albumA: AlbumEntity = {
      id: "album-a" as AlbumId,
      title: "A Album",
      artistId: "artist-1" as ArtistId,
      addedAt: 1,
      updatedAt: 1,
    };

    const artist: ArtistEntity = {
      id: "artist-1" as ArtistId,
      name: "Artist",
      addedAt: 1,
      updatedAt: 1,
    };

    const trackA: TrackEntity = {
      id: "track-a" as TrackId,
      title: "Track A",
      artistIds: [artist.id],
      albumId: albumA.id,
      tagIds: [],
      source: 0,
      state: 0,
      storagePath: "a.mp3",
      duration: 100,
      format: {},
      playCount: 0,
      addedAt: 1,
      albumTitle: albumA.title,
    };

    const trackB: TrackEntity = {
      id: "track-b" as TrackId,
      title: "Track B",
      artistIds: [artist.id],
      albumId: albumB.id,
      tagIds: [],
      source: 0,
      state: 0,
      storagePath: "b.mp3",
      duration: 100,
      format: {},
      playCount: 0,
      addedAt: 1,
      albumTitle: albumB.title,
    };

    repositories.albumRepository.findAllSortedByTitle.mockResolvedValue(ok([albumA, albumB]));
    repositories.trackRepository.findByAlbumId.mockImplementation(async (albumId: AlbumId) => {
      if (albumId === albumA.id) return ok([trackA]);
      return ok([trackB]);
    });
    repositories.artistRepository.findByIds.mockResolvedValue(ok([artist]));
    repositories.albumRepository.findByIds.mockResolvedValue(ok([albumA, albumB]));
    repositories.trackRepository.countAll.mockResolvedValue(ok(2));
    repositories.trackRepository.sumDurationAll.mockResolvedValue(ok(200));

    const result = await getTracksIndexPageData("album_asc");

    expect(repositories.albumRepository.findAllSortedByTitle).toHaveBeenCalledWith(false);
    expect(result.tracks.map(track => track.id)).toEqual([trackA.id, trackB.id]);
    expect(result.total).toBe(2);
  });
});
