import type { AlbumEntity } from "@/db/entities";
import {
  albumRepository,
  artistRepository,
  coverRepository,
  trackRepository,
} from "@/db/repositories";
import { DbError } from "@/db/errors/db.errors";
import { unitOfWork } from "@/db/unit-of-work";
import { queryKeys } from "@/queries/query-keys";
import { syncSearchIndex } from "@/services/search/searchIndex";
import { mapTracks } from "@/types/track";
import type { TrackSortKey } from "@/modules/tracks/types";
import { AlbumId as createAlbumId } from "@/types/ids";
import type { AlbumId, ArtistId, TrackId } from "@/types/ids";
import { queryOptions, skipToken, type QueryClient } from "@tanstack/vue-query";
import {
  invalidateForAlbumMutation,
  removeAlbumCaches,
  settleLibraryReads,
  syncAlbumCaches,
  updateCoverCache,
  removeCoverCache,
} from "./cache";
import { assertValidName } from "@/lib/limits";
import { sortTracks, unique } from "./shared";
import {
  purgeTracksInTx,
  syncAfterTrackPurge,
  TRACK_CASCADE_TABLES,
} from "./track-cascade";
import type { AlbumPageData, PaginatedTracksResult } from "./types";
import { deleteOwnedFiles } from "@/services/track-files";

const PAGE_SIZE = 50;

/** The album row under an id, or null — a miss is an answer, not an error. */
export async function getAlbumLibraryRow(albumId: AlbumId): Promise<AlbumEntity | null> {
  return (await albumRepository.findById(albumId)) ?? null;
}

export interface AlbumChanges {
  title?: string;
  description?: string;
  coverBlob?: Blob;
  removeCover?: boolean;
}

export async function getAlbumByIdOrThrow(albumId: AlbumId) {
  const album = await albumRepository.findById(albumId);

  if (!album) {
    throw new DbError("NOT_FOUND", "Album not found");
  }

  return album;
}

/** Every pinned album when nothing is typed; `limit` bounds a typed search only. */
export async function searchAlbums(query: string, limit = 8) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    const albums = await albumRepository.findAllSortedByTitle();
    return albums.filter(album => album.pinned !== 0);
  }

  const found = await albumRepository.search(normalizedQuery, limit);
  return found.filter(album => album.pinned !== 0);
}

export type AlbumWithArtistName = AlbumEntity & { artistName?: string };

/** `searchAlbums` plus each album's artist name, read in one bulk lookup. */
export const searchAlbumsWithArtistName = async (query: string, limit = 8): Promise<AlbumWithArtistName[]> => {
  const albums = await searchAlbums(query, limit);
  const artists = await artistRepository.findByIds(unique(albums.map(album => album.artistId)));
  const names = new Map(artists.map(artist => [artist.id, artist.name]));
  return albums.map(album => ({ ...album, artistName: names.get(album.artistId) }));
};

export async function getAlbumPageData(albumId: AlbumId, sortKey: TrackSortKey | null = null): Promise<AlbumPageData> {
  const [album, rawTracks] = await Promise.all([
    getAlbumByIdOrThrow(albumId),
    getAlbumTrackEntities(albumId, sortKey),
  ]);

  const artist = await artistRepository.findById(album.artistId);

  if (!artist) {
    throw new DbError("NOT_FOUND", "Artist not found");
  }

  return {
    album,
    artist,
    tracks: mapTracks(rawTracks, [artist], [album]),
  };
}

/**
 * The album's member ids in list order. An album is ordered by (diskNo,
 * trackNo) or by a chosen sort, neither of which an index expresses, so the
 * list is built in memory from every row of the album — once per (album,
 * sort) rather than once per page. Ids only: the page reads its own rows, so
 * a row edited under it is never served from here.
 *
 * `staleTime: Infinity` because the invalidation registry is what expires it,
 * never the clock. Per-album mutations reach it through the `albums/<id>`
 * prefix; artist-wide ones carry no album id and reach it through
 * `keyMatchers.trackOrdersOf`, which `affectedKeys.albums.tracksPages` pairs
 * with the pages. A path that invalidates the pages without the order would
 * leave them cut from a list that still counts removed rows.
 */
const albumTrackOrder = (albumId: AlbumId, sortKey: TrackSortKey | null) =>
  queryOptions({
    queryKey: queryKeys.albums.trackOrder(albumId, sortKey),
    queryFn: async () => (await getAlbumTrackEntities(albumId, sortKey)).map(track => track.id),
    staleTime: Infinity,
  });

export async function getAlbumTracksPaginated(
  albumId: AlbumId,
  offset: number,
  limit = PAGE_SIZE,
  sortKey: TrackSortKey | null = null,
  client: QueryClient,
): Promise<PaginatedTracksResult> {
  const [order, album, total] = await Promise.all([
    client.fetchQuery(albumTrackOrder(albumId, sortKey)),
    getAlbumByIdOrThrow(albumId),
    // Counted live off [albumId+pinned] rather than read off the order: the
    // order is cached until the registry expires it, so between a delete and
    // that invalidation it still names rows that are gone, and the list would
    // advertise a number it cannot fill. The count reads no row.
    trackRepository.countByAlbumId(albumId),
  ]);

  const pageIds = order.slice(offset, offset + limit);

  if (pageIds.length === 0) {
    return { tracks: [], nextOffset: null, total };
  }

  // bulkGet answers in the order asked, so the page keeps the list's order.
  const rawTracks = await trackRepository.findByIds(pageIds);

  const allArtistIds = unique(rawTracks.flatMap(t => t.artistIds));
  const allArtists = allArtistIds.length > 0
    ? await artistRepository.findByIds(allArtistIds)
    : [];

  const mappedTracks = mapTracks(rawTracks, allArtists, [album]);

  const nextOffset = offset + limit < total ? offset + limit : null;

  return {
    tracks: mappedTracks,
    nextOffset,
    total,
  };
}

export async function getAlbumTotalDuration(albumId: AlbumId): Promise<number> {
  return trackRepository.sumDurationByAlbumId(albumId);
}

async function getAlbumTrackEntities(albumId: AlbumId, sortKey: TrackSortKey | null) {
  // Shadow rows (a liked catalog track next to its downloaded copy) are not
  // listed; findByAlbumId keeps them for the cascades.
  const albumTracks = (await trackRepository.findByAlbumId(albumId))
    .filter(track => track.pinned !== 0);

  if (!sortKey) {
    return albumTracks;
  }

  return sortTracks(albumTracks, sortKey);
}

export const albumQueries = {
  detail: (albumId: AlbumId, enabled = true) =>
    queryOptions({
      queryKey: queryKeys.albums.detail(albumId),
      queryFn: () => getAlbumByIdOrThrow(albumId),
      enabled,
    }),
  /**
   * The Dexie row under this id, or null when there is none. A branded
   * remote id may or may not have one — that is the question this answers —
   * so a miss is an answer, not the error `detail` raises.
   */
  libraryRow: (albumId: AlbumId | null) =>
    queryOptions({
      queryKey: queryKeys.albums.libraryRow(albumId),
      queryFn: albumId ? () => getAlbumLibraryRow(albumId) : skipToken,
    }),
  totalDuration: (albumId: AlbumId, enabled = true) =>
    queryOptions({
      queryKey: queryKeys.albums.totalDuration(albumId),
      queryFn: () => getAlbumTotalDuration(albumId),
      enabled,
    }),
} as const;

export async function createAlbumAndSync(
  queryClient: QueryClient,
  artistId: ArtistId,
  title = "New album",
) {
  const now = Date.now();
  const album: AlbumEntity = {
    id: createAlbumId(crypto.randomUUID()),
    title: assertValidName(title, "album"),
    artistId,
    pinned: 1,
    addedAt: now,
    updatedAt: now,
  };

  await albumRepository.create(album);
  await settleLibraryReads(queryClient);
  syncAlbumCaches(queryClient, album);
  invalidateForAlbumMutation(queryClient, { kind: "creation", artistId });
  await syncSearchIndex({ albums: [album.id] });

  return album;
}

export async function updateAlbumAndSync(
  queryClient: QueryClient,
  currentAlbum: AlbumEntity,
  changes: AlbumChanges,
) {
  let nextAlbum = currentAlbum;
  let didUpdateAlbum = false;
  let updatedTrackIds: TrackId[] = [];

  if (changes.coverBlob) {
    const stored = await coverRepository.upsertAlbumCover(currentAlbum.id, changes.coverBlob);
    updateCoverCache("album", currentAlbum.id, stored);
  }
  else if (changes.removeCover) {
    await coverRepository.deleteAlbumCover(currentAlbum.id);
    updateCoverCache("album", currentAlbum.id, null);
  }

  if (changes.title && changes.title !== currentAlbum.title) {
    const title = assertValidName(changes.title, "album");
    nextAlbum = {
      ...currentAlbum,
      title,
      updatedAt: Date.now(),
    };

    // The album row and its tracks' denormalized title change together.
    await unitOfWork.run(["albums", "tracks"], async (uow) => {
      await uow.albums.update(currentAlbum.id, { title });
      await uow.tracks.setAlbumTitleByAlbumId(currentAlbum.id, title);
    });

    updatedTrackIds = await trackRepository.findIdsByAlbumId(currentAlbum.id);

    await settleLibraryReads(queryClient);
    syncAlbumCaches(queryClient, nextAlbum);
    didUpdateAlbum = true;
  }

  if (didUpdateAlbum) {
    await syncSearchIndex({ albums: [currentAlbum.id], tracks: updatedTrackIds });

    invalidateForAlbumMutation(queryClient, {
      kind: "titleChange",
      albumId: currentAlbum.id,
      artistId: currentAlbum.artistId,
    });
  }

  return nextAlbum;
}

/**
 * `deleteTracks` cascades the album's tracks and their playlist references in
 * one transaction; cache, search and their files are dealt with strictly after it. Without it the
 * album only ungroups — its tracks stay in the library, remote ones included,
 * keeping whatever is downloaded.
 */
export async function deleteAlbumAndSync(
  queryClient: QueryClient,
  albumEntity: AlbumEntity | null,
  options: { deleteTracks?: boolean } = {},
) {
  if (!albumEntity) {
    return;
  }

  const rawTracks = await trackRepository.findByAlbumId(albumEntity.id);
  const cascadeTracks = options.deleteTracks === true;
  const trackIds = rawTracks.map(track => track.id);
  const now = Date.now();

  const removals = await unitOfWork.run(
    TRACK_CASCADE_TABLES,
    async (uow) => {
      // An empty shadow album (0 tracks) is deleted explicitly below.
      const purged = cascadeTracks
        ? await purgeTracksInTx(uow, rawTracks, now)
        : [];

      if (!cascadeTracks && rawTracks.length > 0) {
        // Detach fully — a dangling albumId would keep pointing at a dead row.
        await uow.tracks.updateMany(rawTracks.map(track => ({
          key: track.id,
          changes: { albumTitle: "", albumId: createAlbumId("") },
        })));
      }

      await uow.covers.deleteAlbumCover(albumEntity.id);
      await uow.albums.delete(albumEntity.id);

      return purged;
    },
  );
  if (cascadeTracks) await deleteOwnedFiles(rawTracks);

  await settleLibraryReads(queryClient);
  await syncAfterTrackPurge(
    queryClient,
    cascadeTracks ? trackIds : [],
    removals,
  );
  await syncSearchIndex({ albums: [albumEntity.id], tracks: cascadeTracks ? [] : trackIds });

  removeAlbumCaches(queryClient, albumEntity.id, albumEntity.artistId);

  removeCoverCache("album", albumEntity.id);

  invalidateForAlbumMutation(queryClient, {
    kind: "removal",
    artistId: albumEntity.artistId,
    playlistIds: removals.map(({ next }) => next.id),
  });
}
