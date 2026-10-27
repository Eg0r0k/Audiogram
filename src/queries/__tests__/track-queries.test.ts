import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    setLyrics: vi.fn(),
    likeMany: vi.fn(),
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

import { searchTracks, syncSearchIndex } from "@/services/search/searchIndex";
import { queryKeys } from "@/queries/query-keys";
import {
  attachTrackLyricsAndSync,
  favoriteTracksAndSync,
  getAllTracksPaginated,
  getLikedTracksPageData,
  getLikedTracksPaginated,
  searchTracksPaginated,
  setTracksLikedAndSync,
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

    const result = await getAllTracksPaginated(null, 50, "album_asc");

    expect(tracks.members().page).toHaveBeenCalledWith({ sort: "album_asc", after: null, limit: 50 });
    expect(result.tracks.map(track => track.id)).toEqual([trackA.id, trackB.id]);
    expect(result.total).toBe(2);
  });

  describe("getAllTracksPaginated over the whole library", () => {
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
      const first = await getAllTracksPaginated(null, 50, null);
      expect(first.total).toBe(1000);
      expect(first.tracks).toHaveLength(50);
      expect(first.nextOffset).toBeNull();
      expect(first.last).toEqual(["t-950"]);

      members.count.mockClear();
      const second = await getAllTracksPaginated(first.last ?? null, 50, null);
      expect(members.count).not.toHaveBeenCalled();
      expect(members.page).toHaveBeenLastCalledWith({ sort: "date_added_desc", after: ["t-950"], limit: 50 });
      expect(second.tracks).toHaveLength(50);
      expect(second.last).toEqual(["t-900"]);
    });

    it("ends the list on a page that comes back short", async () => {
      const last = await getAllTracksPaginated(["t-959"], 50, "album_asc");
      expect(last.tracks).toHaveLength(40);
      expect(last.last).toBeNull();
      expect(last.nextOffset).toBeNull();
    });

    it("the second /all page starts exactly after the first page's last row", async () => {
      const inTitleOrder = (await members.rows({ sort: "title_asc" })).map(track => track.id);

      const first = await getAllTracksPaginated(null, 50, "title_asc");
      const second = await getAllTracksPaginated(first.last ?? null, 50, "title_asc");

      expect(members.page).toHaveBeenLastCalledWith({ sort: "title_asc", after: first.last, limit: 50 });
      expect(first.last).toEqual([first.tracks[49].id]);
      expect([...first.tracks, ...second.tracks].map(track => track.id)).toEqual(inTitleOrder.slice(0, 100));
    });

    it("a search keeps paging by offset", async () => {
      vi.mocked(searchTracks).mockResolvedValue({ tracks: [], total: 120, totalDuration: 0, matches: {} });

      const page = await searchTracksPaginated("track", 50, 50, null);

      expect(searchTracks).toHaveBeenCalledWith("track", 50, 50);
      expect(page.nextOffset).toBe(100);
      expect(page.last).toBeUndefined();
      expect(members.page).not.toHaveBeenCalled();
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

      const result = await getLikedTracksPaginated(null, 50);

      expect(liked.page).toHaveBeenCalledWith({ after: null, limit: 50 });
      expect(liked.count).toHaveBeenCalledOnce();
      expect(liked.sumDuration).not.toHaveBeenCalled();
      expect(result.total).toBe(1);
      expect(result.tracks).toHaveLength(1);
    });

    it("with sortKey pages the sorted liked scope in one read instead of double-fetch", async () => {
      const liked = useTrackScopes({ liked: [track] }).liked();

      const result = await getLikedTracksPaginated(null, 50, "title_asc");

      expect(liked.page).toHaveBeenCalledOnce();
      expect(liked.page).toHaveBeenCalledWith({ sort: "title_asc", after: null, limit: 50 });
      expect(repositories.trackRepository.withIds).not.toHaveBeenCalled();
      expect(result.tracks).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("returns last null when the page comes back short", async () => {
      useTrackScopes({ liked: [track] });

      const result = await getLikedTracksPaginated(null, 50);

      expect(result.last).toBeNull();
      expect(result.nextOffset).toBeNull();
    });

    it("resumes after the last row of a full page and counts on the first page only", async () => {
      const other = { ...track, id: "track-2" as TrackId };
      const liked = useTrackScopes({ liked: [track, other] }).liked();

      const head = await getLikedTracksPaginated(null, 1);
      const next = await getLikedTracksPaginated(head.last ?? null, 1);

      expect(head).toMatchObject({ nextOffset: null, last: [track.id], total: 2 });
      expect(liked.page).toHaveBeenLastCalledWith({ after: [track.id], limit: 1 });
      expect(next.tracks.map(row => row.id)).toEqual([other.id]);
      expect(liked.count).toHaveBeenCalledOnce();
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

      // It must be searchable without waiting for a full reindex.
      expect(syncSearchIndex).toHaveBeenCalledWith({ albums: [created.id] });
    });

    it("does not sync an album into the search index when reusing an existing album", async () => {
      repositories.albumRepository.findByArtistId.mockResolvedValue([existingAlbum]);

      await updateTrackMetadataAndSync(queryClient, track, {
        title: track.title,
        artistNames: ["A"],
        albumTitle: "GREATEST HITS",
      });

      expect(repositories.albumRepository.create).not.toHaveBeenCalled();
      expect(syncSearchIndex).not.toHaveBeenCalledWith(expect.objectContaining({ albums: expect.anything() }));
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

  describe("the query cache", () => {
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

    beforeEach(() => {
      repositories.trackRepository.findById.mockResolvedValue(entity);
      repositories.trackRepository.likeMany.mockResolvedValue(1);
      repositories.artistRepository.findByName.mockResolvedValue(undefined);
      repositories.albumRepository.findByArtistId.mockResolvedValue([]);
      repositories.coverRepository.findByOwner.mockResolvedValue(undefined);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("a mutation does not touch the query cache", async () => {
      const queryClient = new QueryClient();
      const setQueryData = vi.spyOn(QueryClient.prototype, "setQueryData");
      const invalidateQueries = vi.spyOn(QueryClient.prototype, "invalidateQueries");
      const expectOnlyStatsInvalidated = () => {
        expect(setQueryData).not.toHaveBeenCalled();
        for (const [filters] of invalidateQueries.mock.calls) {
          expect((filters as { queryKey?: readonly unknown[] } | undefined)?.queryKey?.[0]).toBe("stats");
        }
      };

      await toggleTrackLikeAndSync(queryClient, track);
      expectOnlyStatsInvalidated();

      await updateTrackMetadataAndSync(queryClient, track, { title: "Two", artistNames: ["New"], albumTitle: "Fresh" });
      expectOnlyStatsInvalidated();

      await attachTrackLyricsAndSync(queryClient, track, { lyricsPath: "lyrics/t-1.lrc", lyricsFileName: null });
      await setTracksLikedAndSync([entity.id], true);
      await favoriteTracksAndSync([track]);
      expectOnlyStatsInvalidated();
    });

    it("a like and a metadata edit mark the stats rows that show the track stale", async () => {
      const queryClient = new QueryClient();
      const historyKey = queryKeys.stats.recentHistory(100);
      const isStale = () => queryClient.getQueryState(historyKey)?.isInvalidated;

      queryClient.setQueryData(historyKey, []);
      await toggleTrackLikeAndSync(queryClient, track);
      expect(isStale()).toBe(true);

      queryClient.setQueryData(historyKey, []);
      await updateTrackMetadataAndSync(queryClient, track, { title: "Two", artistNames: [] });
      expect(isStale()).toBe(true);
    });
  });
});
