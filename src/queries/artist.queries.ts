import type { ArtistEntity } from "@/db/entities";
import {
  albumRepository,
  artistRepository,
  coverRepository,
  trackRepository,
} from "@/db/repositories";
import { DbError } from "@/db/errors/db.errors";
import { unitOfWork, type Scope } from "@/db/unit-of-work";
import { queryKeys } from "@/queries/query-keys";
import { syncSearchIndex } from "@/services/search/searchIndex";
import { mapTracks } from "@/types/track";
import type { TrackSortKey } from "@/modules/tracks/types";
import { ArtistId as createArtistId } from "@/types/ids";
import type { ArtistId, TrackId } from "@/types/ids";
import { queryOptions, skipToken, type QueryClient } from "@tanstack/vue-query";
import {
  invalidateForArtistMutation,
  removeAlbumCaches,
  removeArtistCaches,
  settleLibraryReads,
  syncArtistCaches,
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
import type { ArtistPageData, PaginatedTracksResult, PaginatedAlbumsResult } from "./types";
import { deleteOwnedFiles } from "@/services/track-files";

/** The artist row under an id, or null — a miss is an answer, not an error. */
export async function getArtistLibraryRow(artistId: ArtistId): Promise<ArtistEntity | null> {
  return (await artistRepository.findById(artistId)) ?? null;
}

export interface ArtistChanges {
  name?: string;
  bio?: string;
  coverBlob?: Blob;
  removeCover?: boolean;
}

const PAGE_SIZE = 50;

async function getArtistTrackEntities(artistId: ArtistId, sortKey: TrackSortKey | null) {
  const allTracks = await trackRepository.findByArtistId(artistId);
  // A local artist can absorb remote tracks via substitution — skip shadows.
  const artistTracks = allTracks.filter(track => track.pinned !== 0);

  if (!sortKey) {
    return artistTracks;
  }

  return sortTracks(artistTracks, sortKey);
}

export async function getArtistsByIds(artistIds: ArtistId[]): Promise<ArtistEntity[]> {
  return artistRepository.findByIds(artistIds);
}

export async function getArtists() {
  return artistRepository.findPinned();
}

export async function getArtistByIdOrThrow(artistId: ArtistId) {
  const artist = await artistRepository.findById(artistId);

  if (!artist) {
    throw new DbError("NOT_FOUND", "Artist not found");
  }

  return artist;
}

/** Every pinned artist when nothing is typed — a cap there would hide part
 *  of the library from the picker; `limit` bounds a typed search only. */
export async function searchArtists(query: string, limit = 8) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return getArtists();
  }

  const found = await artistRepository.search(normalizedQuery, limit);
  return found.filter(artist => artist.pinned !== 0);
}

export async function getArtistPageData(artistId: ArtistId, sortKey: TrackSortKey | null = null): Promise<ArtistPageData> {
  const [artist, allAlbums, rawTracks] = await Promise.all([
    getArtistByIdOrThrow(artistId),
    albumRepository.findByArtistId(artistId),
    getArtistTrackEntities(artistId, sortKey),
  ]);
  const albums = allAlbums.filter(album => album.pinned !== 0);

  const allArtistIds = unique(rawTracks.flatMap(t => t.artistIds));
  const allArtists = await artistRepository.findByIds(allArtistIds);

  return {
    artist,
    albums,
    tracks: mapTracks(rawTracks, allArtists, albums),
  };
}

/**
 * The artist's member ids in list order. `artistIds` is multi-entry, and
 * IndexedDB forbids multiEntry inside a compound key, so membership cannot
 * ride along with it: the list is built by subtracting the shadow set, once
 * per (artist, sort) rather than once per page. That set holds every remote
 * track ever queued from browsing, so it belongs to no artist in particular
 * and only grows — paging against it directly costs the whole set per page.
 *
 * `staleTime: Infinity` because the invalidation registry is what expires it,
 * never the clock — `affectedKeys.artists.tracksPages` pairs it with the
 * pages, which would otherwise be cut from a list that still counts removed
 * rows. Ids only: the page reads its own rows, so a row edited under it is
 * never served from here.
 */
const artistTrackOrder = (artistId: ArtistId, sortKey: TrackSortKey | null) =>
  queryOptions({
    queryKey: queryKeys.artists.trackOrder(artistId, sortKey),
    // Unsorted needs no row at all — the ids come straight off the index.
    queryFn: async (): Promise<TrackId[]> =>
      sortKey
        ? (await getArtistTrackEntities(artistId, sortKey)).map(track => track.id)
        : trackRepository.findIdsByArtistId(artistId),
    staleTime: Infinity,
  });

export async function getArtistTracksPaginated(
  artistId: ArtistId,
  offset: number,
  limit = PAGE_SIZE,
  sortKey: TrackSortKey | null = null,
  client: QueryClient,
): Promise<PaginatedTracksResult> {
  const order = await client.fetchQuery(artistTrackOrder(artistId, sortKey));

  // Read off the order, unlike an album's total, which is counted live: no
  // index can count an artist's members — that is what the order itself is
  // for — so between a delete and the invalidation that expires the order,
  // this still counts the row. The registry heals it; nothing cheaper can.
  const total = order.length;
  const pageIds = order.slice(offset, offset + limit);

  if (pageIds.length === 0) {
    return { tracks: [], nextOffset: null, total };
  }

  // bulkGet answers in the order asked, so the page keeps the list's order.
  const rawTracks = await trackRepository.findByIds(pageIds);

  await getArtistByIdOrThrow(artistId);
  const albumIds = unique(rawTracks.map(track => track.albumId));
  const albums = await albumRepository.findByIds(albumIds);

  const allArtistIds = unique(rawTracks.flatMap(t => t.artistIds));
  const allArtists = await artistRepository.findByIds(allArtistIds);

  const mappedTracks = mapTracks(rawTracks, allArtists, albums);

  const nextOffset = offset + limit < total ? offset + limit : null;

  return {
    tracks: mappedTracks,
    nextOffset,
    total,
  };
}

export async function getArtistAlbumsPaginated(
  artistId: ArtistId,
  offset: number,
  limit = PAGE_SIZE,
): Promise<PaginatedAlbumsResult> {
  const [albums, countResult] = await Promise.all([
    albumRepository.findByArtistIdPaginated(artistId, offset, limit),
    albumRepository.countByArtistId(artistId),
  ]);

  const total = countResult;
  const nextOffset = offset + limit < total ? offset + limit : null;

  return {
    albums,
    nextOffset,
    total,
  };
}

export const artistQueries = {
  detail: (artistId: ArtistId, enabled = true) =>
    queryOptions({
      queryKey: queryKeys.artists.detail(artistId),
      queryFn: () => getArtistByIdOrThrow(artistId),
      enabled,
    }),
  /**
   * The Dexie row under this id, or null when there is none. A branded
   * remote id may or may not have one — that is the question this answers —
   * so a miss is an answer, not the error `detail` raises.
   */
  libraryRow: (artistId: ArtistId | null) =>
    queryOptions({
      queryKey: queryKeys.artists.libraryRow(artistId),
      queryFn: artistId ? () => getArtistLibraryRow(artistId) : skipToken,
    }),
} as const;

export async function createArtistAndSync(
  queryClient: QueryClient,
  name = "New artist",
) {
  const now = Date.now();
  const artist: ArtistEntity = {
    id: createArtistId(crypto.randomUUID()),
    name: assertValidName(name, "artist"),
    pinned: 1,
    addedAt: now,
    updatedAt: now,
  };

  await artistRepository.create(artist);
  await settleLibraryReads(queryClient);
  syncArtistCaches(queryClient, artist);
  await syncSearchIndex({ artists: [artist.id] });

  return artist;
}

/** Recomputes the denormalized artistName of the artist's tracks. Dexie-only: safe inside a transaction. */
async function syncTrackArtistNames(uow: Scope<"tracks" | "artists">, artistId: ArtistId, nextArtistName: string) {
  const tracks = await uow.tracks.findByArtistId(artistId);

  if (tracks.length === 0) {
    return;
  }

  const allArtistIds = unique(tracks.flatMap(track => track.artistIds));
  const artists = await uow.artists.findByIds(allArtistIds);
  const artistNameById = new Map(artists.map(artist => [artist.id, artist.name]));
  artistNameById.set(artistId, nextArtistName);

  await uow.tracks.updateMany(tracks.map(track => ({
    key: track.id,
    changes: {
      artistName: track.artistIds
        .map(id => artistNameById.get(id))
        .filter(Boolean)
        .join(", ") || "Unknown Artist",
    },
  })));
}

export async function updateArtistAndSync(
  queryClient: QueryClient,
  currentArtist: ArtistEntity,
  changes: ArtistChanges,
) {
  if (changes.coverBlob) {
    const stored = await coverRepository.upsertArtistCover(currentArtist.id, changes.coverBlob);
    updateCoverCache("artist", currentArtist.id, stored);
  }
  else if (changes.removeCover) {
    await coverRepository.deleteArtistCover(currentArtist.id);
    updateCoverCache("artist", currentArtist.id, null);
  }

  const updateData: Partial<ArtistEntity> = {};

  if (changes.name && changes.name !== currentArtist.name) {
    updateData.name = assertValidName(changes.name, "artist");
  }

  if (changes.bio !== undefined) {
    updateData.bio = changes.bio;
  }

  const nextArtist: ArtistEntity = {
    ...currentArtist,
    ...updateData,
    updatedAt: Date.now(),
  };

  if (Object.keys(updateData).length > 0) {
    // Artist row and its tracks' denormalized names move together.
    await unitOfWork.run(["artists", "tracks"], async (uow) => {
      await uow.artists.update(currentArtist.id, updateData);
      if (updateData.name) {
        await syncTrackArtistNames(uow, currentArtist.id, nextArtist.name);
      }
    });

    await settleLibraryReads(queryClient);
    syncArtistCaches(queryClient, nextArtist);

    const [albums, tracks] = await Promise.all([
      albumRepository.findByArtistId(currentArtist.id),
      trackRepository.findByArtistId(currentArtist.id),
    ]);

    await syncSearchIndex({
      artists: [currentArtist.id],
      albums: albums.map(album => album.id),
      tracks: tracks.map(track => track.id),
    });
  }

  invalidateForArtistMutation(queryClient, {
    kind: "change",
    artistId: currentArtist.id,
  });

  return nextArtist;
}

/**
 * Deleting an artist always takes their albums. Their tracks are detached and
 * stay in the library by default; `deleteTracks` removes them instead — note
 * that includes tracks credited to a second artist too.
 */
export async function deleteArtistAndSync(
  queryClient: QueryClient,
  artistEntity: ArtistEntity | null,
  options: { deleteTracks?: boolean } = {},
) {
  if (!artistEntity) {
    return;
  }

  const cascadeTracks = options.deleteTracks === true;
  const albums = await albumRepository.findByArtistId(artistEntity.id);
  const rawTracks = await trackRepository.findByArtistId(artistEntity.id);
  const albumTracks = (await Promise.all(
    albums.map(album => trackRepository.findByAlbumId(album.id)),
  )).flat();
  const affectedTracks = [...new Map(
    [...rawTracks, ...albumTracks].map(track => [track.id, track]),
  ).values()];
  const affectedTrackIds = affectedTracks.map(track => track.id);
  const now = Date.now();
  const remainingArtistIds = unique(
    affectedTracks.flatMap(track => track.artistIds.filter(id => id !== artistEntity.id)),
  );
  const remainingArtists = await artistRepository.findByIds(remainingArtistIds);
  const remainingArtistNameById = new Map(remainingArtists.map(artist => [artist.id, artist.name]));
  const deletedAlbumIds = new Set(albums.map(album => album.id));

  const trackUpdates = affectedTracks.map((track) => {
    const nextArtistIds = track.artistIds.filter(id => id !== artistEntity.id);
    // "" not undefined: both fields are indexed (see TrackEntity).
    const nextArtistName = nextArtistIds
      .map(id => remainingArtistNameById.get(id))
      .filter(Boolean)
      .join(", ");
    const nextAlbumTitle = deletedAlbumIds.has(track.albumId) ? "" : track.albumTitle;

    return {
      key: track.id,
      changes: {
        artistIds: nextArtistIds,
        artistName: nextArtistName,
        albumTitle: nextAlbumTitle,
      },
    };
  });

  const removals = await unitOfWork.run(
    TRACK_CASCADE_TABLES,
    async (uow) => {
      // The purge GCs albums that lost their last track; the artist's own
      // albums are dropped explicitly right after, empty or not.
      const purged = cascadeTracks
        ? await purgeTracksInTx(uow, affectedTracks, now)
        : [];

      if (!cascadeTracks && trackUpdates.length > 0) {
        await uow.tracks.updateMany(trackUpdates);
      }
      for (const album of albums) {
        await uow.covers.deleteAlbumCover(album.id);
      }
      if (albums.length > 0) {
        await uow.albums.deleteMany(albums.map(album => album.id));
      }
      await uow.covers.deleteArtistCover(artistEntity.id);
      await uow.artists.delete(artistEntity.id);

      return purged;
    },
  );
  if (cascadeTracks) await deleteOwnedFiles(affectedTracks);

  await settleLibraryReads(queryClient);
  await syncAfterTrackPurge(
    queryClient,
    cascadeTracks ? affectedTrackIds : [],
    removals,
  );

  for (const album of albums) {
    removeAlbumCaches(queryClient, album.id, artistEntity.id);
    removeCoverCache("album", album.id);
  }
  await syncSearchIndex({
    artists: [artistEntity.id],
    albums: albums.map(album => album.id),
    tracks: cascadeTracks ? [] : affectedTrackIds,
  });

  removeArtistCaches(queryClient, artistEntity.id);
  removeCoverCache("artist", artistEntity.id);

  invalidateForArtistMutation(queryClient, {
    kind: "removal",
    playlistIds: removals.map(({ next }) => next.id),
  });
}
