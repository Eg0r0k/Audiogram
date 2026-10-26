import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AlbumEntity, ArtistEntity, TrackEntity } from "@/db/entities";
import { TrackSource, TrackState } from "@/db/entities";
import { QueryClient } from "@tanstack/vue-query";
import type { AlbumId, ArtistId, TrackId } from "@/types/ids";
import type { Track } from "@/types/track";
import { fakeTrackRepository, type FakeTrackScopes } from "@/test/fakeTrackScope";

const repositories = vi.hoisted(() => ({
  albumRepository: {
    findAllSortedByTitle: vi.fn(),
    findByIds: vi.fn(),
    findById: vi.fn(),
    findByArtistId: vi.fn(),
    create: vi.fn(),
  },
  artistRepository: {
    findByIds: vi.fn(),
    findByName: vi.fn(),
    create: vi.fn(),
  },
  trackRepository: {
    findById: vi.fn(),
    update: vi.fn(),
    setLiked: vi.fn(),
  },
  coverRepository: {
    findByOwner: vi.fn(),
    upsertOwnerCover: vi.fn(),
    deleteByOwner: vi.fn(),
  },
}));

vi.mock("@/db/repositories", () => repositories);
vi.mock("@/services/search/searchIndex", () => ({
  searchTracks: vi.fn(),
  syncSearchIndex: vi.fn(async () => {}),
}));

import { syncSearchIndex } from "@/services/search/searchIndex";
import { queryKeys } from "@/queries/query-keys";
import * as cache from "../cache";
import type { LibrarySummaryData } from "../types";
import {
  getLikedTracksPageData,
  getLikedTracksPaginated,
  getTracksPaginated,
  toggleTrackLikeAndSync,
  updateTrackMetadataAndSync,
} from "../track.queries";

const useTrackScopes = (scopes: FakeTrackScopes) =>
  Object.assign(repositories.trackRepository, fakeTrackRepository(scopes));

describe("track.queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTrackScopes({});
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

    const tracks = useTrackScopes({ members: [trackB, trackA] });
    repositories.artistRepository.findByIds.mockResolvedValue([artist]);
    repositories.albumRepository.findByIds.mockResolvedValue([albumA, albumB]);

    const result = await getTracksPaginated(0, "", 50, "album_asc");

    expect(tracks.members().rows).toHaveBeenCalledWith({ sort: "album_asc", offset: 0, limit: 51 });
    expect(result.tracks.map(track => track.id)).toEqual([trackA.id, trackB.id]);
    expect(result.total).toBe(2);
  });

  describe("getTracksPaginated over the whole library", () => {
    const row = (i: number): TrackEntity => ({
      id: `t-${i}` as TrackId,
      title: `Track ${i}`,
      artistIds: [],
      tagIds: [],
      source: 0,
      state: 0,
      storagePath: `${i}.mp3`,
      duration: 100,
      format: {},
      playCount: 0,
      addedAt: 1,
    });
    const rows = (from: number, count: number) => Array.from({ length: count }, (_, i) => row(from + i));
    let members: ReturnType<ReturnType<typeof useTrackScopes>["members"]>;

    beforeEach(() => {
      repositories.artistRepository.findByIds.mockResolvedValue([]);
      repositories.albumRepository.findByIds.mockResolvedValue([]);
      members = useTrackScopes({ members: rows(0, 1000) }).members();
    });

    it("counts the library for the first page only", async () => {
      const first = await getTracksPaginated(0, "", 50, "album_asc");
      expect(first.total).toBe(1000);
      expect(first.tracks).toHaveLength(50);
      expect(first.nextOffset).toBe(50);

      members.count.mockClear();
      const second = await getTracksPaginated(50, "", 50, null);
      expect(members.count).not.toHaveBeenCalled();
      expect(members.rows).toHaveBeenLastCalledWith({ sort: "date_added_desc", offset: 50, limit: 51 });
      expect(second.tracks).toHaveLength(50);
      expect(second.nextOffset).toBe(100);
    });

    it("ends the list on a page that comes back short", async () => {
      const last = await getTracksPaginated(950, "", 50, "album_asc");
      expect(last.tracks).toHaveLength(50);
      expect(last.nextOffset).toBeNull();
    });
  });

  describe("getLikedTracksPageData", () => {
    const artist: ArtistEntity = {
      id: "artist-1" as ArtistId,
      name: "Artist",
      addedAt: 1,
      updatedAt: 1,
    };

    const album: AlbumEntity = {
      id: "album-1" as AlbumId,
      title: "Album",
      artistId: artist.id,
      addedAt: 1,
      updatedAt: 1,
    };

    const trackA: TrackEntity = {
      id: "track-a" as TrackId,
      title: "Track A",
      artistIds: [artist.id],
      albumId: album.id,
      albumTitle: album.title,
      tagIds: [],
      source: TrackSource.LOCAL_INTERNAL,
      state: TrackState.READY,
      storagePath: "a.mp3",
      duration: 100,
      format: {},
      playCount: 0,
      addedAt: 1,
      likedAt: 100,
    };

    const trackB: TrackEntity = {
      id: "track-b" as TrackId,
      title: "Track B",
      artistIds: [artist.id],
      albumId: album.id,
      albumTitle: album.title,
      tagIds: [],
      source: TrackSource.LOCAL_INTERNAL,
      state: TrackState.READY,
      storagePath: "b.mp3",
      duration: 200,
      format: {},
      playCount: 0,
      addedAt: 2,
      likedAt: 200,
    };

    const likedTracks = [trackA, trackB];

    beforeEach(() => {
      repositories.artistRepository.findByIds.mockResolvedValue([artist]);
      repositories.albumRepository.findByIds.mockResolvedValue([album]);
    });

    it("without sortKey reads the liked scope in its own order and returns mapped tracks", async () => {
      const liked = useTrackScopes({ liked: likedTracks }).liked();

      const result = await getLikedTracksPageData();

      expect(liked.rows).toHaveBeenCalledOnce();
      expect(liked.rows).toHaveBeenCalledWith();
      expect(result.tracks.map(t => t.id)).toEqual([trackA.id, trackB.id]);
      expect(result.tracks.every(t => t.isLiked)).toBe(true);
    });

    it("with sortKey reads the liked scope sorted and returns mapped tracks", async () => {
      const liked = useTrackScopes({ liked: [trackB, trackA] }).liked();

      const result = await getLikedTracksPageData("title_asc");

      expect(liked.rows).toHaveBeenCalledOnce();
      expect(liked.rows).toHaveBeenCalledWith({ sort: "title_asc" });
      expect(result.tracks.map(t => t.id)).toEqual([trackA.id, trackB.id]);
    });
  });

  describe("getLikedTracksPaginated", () => {
    const artist: ArtistEntity = {
      id: "artist-1" as ArtistId,
      name: "Artist",
      addedAt: 1,
      updatedAt: 1,
    };

    const album: AlbumEntity = {
      id: "album-1" as AlbumId,
      title: "Album",
      artistId: artist.id,
      addedAt: 1,
      updatedAt: 1,
    };

    const track: TrackEntity = {
      id: "track-1" as TrackId,
      title: "Track",
      artistIds: [artist.id],
      albumId: album.id,
      albumTitle: album.title,
      tagIds: [],
      source: TrackSource.LOCAL_INTERNAL,
      state: TrackState.READY,
      storagePath: "t.mp3",
      duration: 100,
      format: {},
      playCount: 0,
      addedAt: 1,
      likedAt: 100,
    };

    beforeEach(() => {
      repositories.artistRepository.findByIds.mockResolvedValue([artist]);
      repositories.albumRepository.findByIds.mockResolvedValue([album]);
    });

    it("without sortKey pages and counts the liked scope without summing its durations", async () => {
      const liked = useTrackScopes({ liked: [track] }).liked();

      const result = await getLikedTracksPaginated(0, 50);

      expect(liked.rows).toHaveBeenCalledWith({ offset: 0, limit: 50 });
      expect(liked.count).toHaveBeenCalledOnce();
      expect(liked.sumDuration).not.toHaveBeenCalled();
      expect(result.total).toBe(1);
      expect(result.tracks).toHaveLength(1);
    });

    it("with sortKey pages the sorted liked scope in one read instead of double-fetch", async () => {
      const liked = useTrackScopes({ liked: [track] }).liked();

      const result = await getLikedTracksPaginated(0, 50, "title_asc");

      expect(liked.rows).toHaveBeenCalledOnce();
      expect(liked.rows).toHaveBeenCalledWith({ sort: "title_asc", offset: 0, limit: 50 });
      expect(repositories.trackRepository.withIds).not.toHaveBeenCalled();
      expect(result.tracks).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("returns nextOffset=null when no more pages", async () => {
      useTrackScopes({ liked: [track] });

      const result = await getLikedTracksPaginated(0, 50);

      expect(result.nextOffset).toBeNull();
    });

    it("returns nextOffset when more pages exist", async () => {
      useTrackScopes({ liked: [track] }).liked().count.mockResolvedValue(100);

      const result = await getLikedTracksPaginated(0, 50);

      expect(result.nextOffset).toBe(50);
    });
  });

  describe("updateTrackMetadataAndSync album by title", () => {
    const artist: ArtistEntity = {
      id: "artist-1" as ArtistId,
      name: "A",
      pinned: 1,
      addedAt: 1,
      updatedAt: 1,
    };

    const existingAlbum: AlbumEntity = {
      id: "album-1" as AlbumId,
      title: "Greatest Hits",
      artistId: artist.id,
      pinned: 1,
      addedAt: 1,
      updatedAt: 1,
    };

    const currentTrackEntity: TrackEntity = {
      id: "track-1" as TrackId,
      title: "Song",
      artistIds: [artist.id],
      albumId: "album-old" as AlbumId,
      albumTitle: "Old Album",
      artistName: "A",
      tagIds: [],
      source: TrackSource.LOCAL_INTERNAL,
      state: TrackState.READY,
      storagePath: "t.mp3",
      duration: 100,
      format: {},
      playCount: 0,
      addedAt: 1,
    };

    const track: Track = {
      kind: "library",
      id: currentTrackEntity.id,
      title: currentTrackEntity.title,
      artist: "A",
      artistIds: [artist.id],
      albumId: currentTrackEntity.albumId,
      albumName: "Old Album",
      storagePath: "t.mp3",
      source: TrackSource.LOCAL_INTERNAL,
      state: TrackState.READY,
      duration: 100,
      isLiked: false,
    };

    const summaryWith = (albums: AlbumEntity[]): LibrarySummaryData => ({
      artists: [artist],
      albums,
      playlists: [],
      folders: [],
      likedCount: 0,
    });

    const summaryAlbums = (client: QueryClient) =>
      client.getQueryData<LibrarySummaryData>(queryKeys.library.summary())!.albums;

    let queryClient: QueryClient;

    beforeEach(() => {
      queryClient = new QueryClient();
      repositories.trackRepository.findById.mockResolvedValue(currentTrackEntity);
      repositories.trackRepository.update.mockResolvedValue(1);
      repositories.artistRepository.findByName.mockResolvedValue(artist);
    });

    it("reuses an existing album of the first artist matched case-insensitively", async () => {
      repositories.albumRepository.findByArtistId.mockResolvedValue([existingAlbum]);

      const next = await updateTrackMetadataAndSync(queryClient, track, {
        title: track.title,
        artistNames: ["A"],
        albumTitle: "GREATEST HITS",
      });

      expect(next.albumId).toBe(existingAlbum.id);
      expect(repositories.albumRepository.create).not.toHaveBeenCalled();
    });

    it("creates a new album row when no identity match exists", async () => {
      repositories.albumRepository.findByArtistId.mockResolvedValue([existingAlbum]);
      repositories.albumRepository.create.mockResolvedValue("new-album" as AlbumId);
      // Seed the sidebar's summary like a mounted library would, so the
      // point-sync has something to patch.
      queryClient.setQueryData(queryKeys.library.summary(), summaryWith([existingAlbum]));

      const next = await updateTrackMetadataAndSync(queryClient, track, {
        title: track.title,
        artistNames: ["A"],
        albumTitle: "Brand New Album",
      });

      expect(repositories.albumRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Brand New Album",
          artistId: artist.id,
          pinned: 1,
        }),
      );
      const created = repositories.albumRepository.create.mock.calls[0][0] as AlbumEntity;
      expect(next.albumId).toBe(created.id);

      // The new album must be immediately visible in the sidebar, not only
      // reachable after a reload.
      expect(summaryAlbums(queryClient)).toEqual([existingAlbum, created]);

      // And it must be searchable without waiting for a full reindex.
      expect(syncSearchIndex).toHaveBeenCalledWith({ albums: [created.id] });
    });

    it("does not sync an album into the search index or list cache when reusing an existing album", async () => {
      repositories.albumRepository.findByArtistId.mockResolvedValue([existingAlbum]);
      queryClient.setQueryData(queryKeys.library.summary(), summaryWith([existingAlbum]));

      await updateTrackMetadataAndSync(queryClient, track, {
        title: track.title,
        artistNames: ["A"],
        albumTitle: "GREATEST HITS",
      });

      expect(repositories.albumRepository.create).not.toHaveBeenCalled();
      expect(syncSearchIndex).not.toHaveBeenCalledWith(expect.objectContaining({ albums: expect.anything() }));
      expect(summaryAlbums(queryClient)).toEqual([existingAlbum]);
    });

    it("hands a track-owned cover over to the newly assigned album", async () => {
      // Fixing the tags of an album-less import may assign one — the embedded
      // art must follow the track.
      const albumless: TrackEntity = { ...currentTrackEntity, albumId: "" as AlbumId, albumTitle: "" };
      repositories.trackRepository.findById.mockResolvedValue(albumless);
      repositories.albumRepository.findById.mockResolvedValue(existingAlbum);
      const coverBlob = new Blob([new Uint8Array(4)], { type: "image/webp" });
      repositories.coverRepository.findByOwner.mockImplementation(
        async (ownerType: string, ownerId: string) =>
          ownerType === "track" && ownerId === albumless.id
            ? { id: "c1", ownerType, ownerId, blob: coverBlob, mimeType: "image/webp", addedAt: 1, updatedAt: 1 }
            : undefined,
      );
      repositories.coverRepository.upsertOwnerCover.mockImplementation(async (ownerType: string, ownerId: string, blob: Blob) =>
        ({ id: "c1", ownerType, ownerId, blob, mimeType: blob.type, addedAt: 2, updatedAt: 2 }));
      repositories.coverRepository.deleteByOwner.mockResolvedValue(undefined);

      await updateTrackMetadataAndSync(queryClient, { ...track, albumId: albumless.albumId }, {
        title: track.title,
        artistNames: ["A"],
        albumId: existingAlbum.id,
      });

      expect(repositories.coverRepository.upsertOwnerCover)
        .toHaveBeenCalledWith("album", existingAlbum.id, coverBlob);
      expect(repositories.coverRepository.deleteByOwner)
        .toHaveBeenCalledWith("track", albumless.id);
    });

    it("keeps the existing album cover and just drops the track-owned one", async () => {
      const albumless: TrackEntity = { ...currentTrackEntity, albumId: "" as AlbumId, albumTitle: "" };
      repositories.trackRepository.findById.mockResolvedValue(albumless);
      repositories.albumRepository.findById.mockResolvedValue(existingAlbum);
      const cover = (ownerType: string, ownerId: string) =>
        ({ id: `c-${ownerType}`, ownerType, ownerId, blob: new Blob(), mimeType: "image/webp", addedAt: 1, updatedAt: 1 });
      repositories.coverRepository.findByOwner.mockImplementation(
        async (ownerType: string, ownerId: string) => cover(ownerType, ownerId),
      );
      repositories.coverRepository.deleteByOwner.mockResolvedValue(undefined);

      await updateTrackMetadataAndSync(queryClient, { ...track, albumId: albumless.albumId }, {
        title: track.title,
        artistNames: ["A"],
        albumId: existingAlbum.id,
      });

      expect(repositories.coverRepository.upsertOwnerCover).not.toHaveBeenCalled();
      expect(repositories.coverRepository.deleteByOwner)
        .toHaveBeenCalledWith("track", albumless.id);
    });

    // Imports store tag-less files with no artist and no album; the editor
    // may not be stricter than that, but an album still needs an artist.
    it("saves a track with no artists, album-less", async () => {
      repositories.coverRepository.findByOwner.mockResolvedValue(undefined);

      const next = await updateTrackMetadataAndSync(queryClient, track, {
        title: "Renamed",
        artistNames: [],
      });

      expect(repositories.artistRepository.findByName).not.toHaveBeenCalled();
      expect(repositories.trackRepository.update).toHaveBeenCalledWith(
        currentTrackEntity.id,
        expect.objectContaining({ title: "Renamed", artistIds: [], artistName: "", albumId: "" }),
      );
      expect(next.artistIds).toEqual([]);
      expect(next.artist).toBe("");
    });

    it("keeps the album a track already has when its artists are cleared", async () => {
      repositories.albumRepository.findById.mockResolvedValue({ ...existingAlbum, id: currentTrackEntity.albumId, title: "Old Album" });

      const next = await updateTrackMetadataAndSync(queryClient, track, {
        title: track.title,
        artistNames: [],
        albumId: currentTrackEntity.albumId,
      });

      expect(next.albumId).toBe(currentTrackEntity.albumId);
      expect(repositories.trackRepository.update).toHaveBeenCalledWith(
        currentTrackEntity.id,
        expect.objectContaining({ artistIds: [], albumId: currentTrackEntity.albumId }),
      );
    });

    it("refuses a new album for a track with no artists", async () => {
      await expect(updateTrackMetadataAndSync(queryClient, track, {
        title: track.title,
        artistNames: [],
        albumTitle: "Greatest Hits",
      })).rejects.toThrow(/artist/);
      await expect(updateTrackMetadataAndSync(queryClient, track, {
        title: track.title,
        artistNames: [],
        albumId: existingAlbum.id,
      })).rejects.toThrow(/artist/);
      expect(repositories.trackRepository.update).not.toHaveBeenCalled();
    });

    it("detaches the track from its album when neither albumId nor albumTitle is given", async () => {
      repositories.coverRepository.findByOwner.mockResolvedValue(undefined);

      const next = await updateTrackMetadataAndSync(queryClient, track, {
        title: track.title,
        artistNames: ["A"],
      });

      expect(repositories.albumRepository.create).not.toHaveBeenCalled();
      expect(repositories.trackRepository.update).toHaveBeenCalledWith(
        currentTrackEntity.id,
        expect.objectContaining({ albumId: "", albumTitle: "" }),
      );
      expect(next.albumId).toBe("");
      expect(next.albumName).toBe("");
    });

    it("copies the album cover onto the track when it leaves the album without art of its own", async () => {
      const coverBlob = new Blob([new Uint8Array(4)], { type: "image/webp" });
      repositories.coverRepository.findByOwner.mockImplementation(
        async (ownerType: string, ownerId: string) =>
          ownerType === "album" && ownerId === currentTrackEntity.albumId
            ? { id: "c1", ownerType, ownerId, blob: coverBlob, mimeType: "image/webp", addedAt: 1, updatedAt: 1 }
            : undefined,
      );
      repositories.coverRepository.upsertOwnerCover.mockImplementation(async (ownerType: string, ownerId: string, blob: Blob) =>
        ({ id: "c2", ownerType, ownerId, blob, mimeType: blob.type, addedAt: 2, updatedAt: 2 }));

      await updateTrackMetadataAndSync(queryClient, track, {
        title: track.title,
        artistNames: ["A"],
      });

      expect(repositories.coverRepository.upsertOwnerCover)
        .toHaveBeenCalledWith("track", currentTrackEntity.id, coverBlob);
      expect(repositories.coverRepository.deleteByOwner).not.toHaveBeenCalled();
    });

    it("persists trackNo and diskNo", async () => {
      repositories.albumRepository.findById.mockResolvedValue(existingAlbum);

      const result = await updateTrackMetadataAndSync(queryClient, track, {
        title: track.title,
        artistNames: ["A"],
        albumId: existingAlbum.id,
        trackNo: 7,
        diskNo: 2,
      });

      expect(repositories.trackRepository.update).toHaveBeenCalledWith(
        currentTrackEntity.id,
        expect.objectContaining({ trackNo: 7, diskNo: 2 }),
      );
      expect(result.trackNo).toBe(7);
      expect(result.diskNo).toBe(2);
    });

    it("clears trackNo and diskNo when explicitly sent null", async () => {
      const trackWithNumbers: TrackEntity = {
        ...currentTrackEntity,
        trackNo: 3,
        diskNo: 1,
      };
      repositories.trackRepository.findById.mockResolvedValue(trackWithNumbers);
      repositories.albumRepository.findById.mockResolvedValue(existingAlbum);

      const result = await updateTrackMetadataAndSync(queryClient, track, {
        title: track.title,
        artistNames: ["A"],
        albumId: existingAlbum.id,
        trackNo: null,
        diskNo: null,
      });

      expect(repositories.trackRepository.update).toHaveBeenCalledWith(
        currentTrackEntity.id,
        expect.objectContaining({ trackNo: undefined, diskNo: undefined }),
      );
      expect(result.trackNo).toBeUndefined();
      expect(result.diskNo).toBeUndefined();
    });

    it("leaves trackNo and diskNo unchanged when omitted (undefined)", async () => {
      const trackWithNumbers: TrackEntity = {
        ...currentTrackEntity,
        trackNo: 3,
        diskNo: 1,
      };
      repositories.trackRepository.findById.mockResolvedValue(trackWithNumbers);
      repositories.albumRepository.findById.mockResolvedValue(existingAlbum);

      const result = await updateTrackMetadataAndSync(queryClient, track, {
        title: track.title,
        artistNames: ["A"],
        albumId: existingAlbum.id,
      });

      expect(repositories.trackRepository.update).toHaveBeenCalledWith(
        currentTrackEntity.id,
        expect.objectContaining({ trackNo: 3, diskNo: 1 }),
      );
      expect(result.trackNo).toBe(3);
      expect(result.diskNo).toBe(1);
    });
  });

  describe("toggleTrackLikeAndSync", () => {
    it("asks the sorted liked pages to re-read after the point-sync", async () => {
      const queryClient = new QueryClient();
      const invalidate = vi.spyOn(cache, "invalidateForTrackMutation").mockResolvedValue(undefined);
      const entity = {
        id: "t-1" as TrackId,
        title: "One",
        artistIds: ["a-1" as ArtistId],
        albumId: "al-1" as AlbumId,
        tagIds: [],
        source: TrackSource.LOCAL_INTERNAL,
        state: TrackState.READY,
        storagePath: "p",
        duration: 10,
        format: {},
        playCount: 0,
        addedAt: 1,
      } as TrackEntity;
      repositories.trackRepository.findById.mockResolvedValue(entity);
      repositories.trackRepository.setLiked.mockResolvedValue(undefined);
      const track = {
        id: entity.id,
        kind: "library",
        title: "One",
        artist: "A",
        artistIds: entity.artistIds,
        albumId: entity.albumId,
        albumName: "Al",
        storagePath: "p",
        source: entity.source,
        state: entity.state,
        duration: 10,
        isLiked: false,
      } as Track;

      await toggleTrackLikeAndSync(queryClient, track);

      expect(invalidate).toHaveBeenCalledWith(queryClient, { kind: "like" });
    });
  });
});
