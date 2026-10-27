import type { AlbumEntity, ArtistEntity, TrackEntity } from "@/db/entities";
import {
  albumRepository,
  artistRepository,
  coverRepository,
  trackRepository,
} from "@/db/repositories";
import { DbError } from "@/db/errors/db.errors";
import type { TrackScope } from "@/db/repositories/track.scope";
import { unitOfWork, type Scope } from "@/db/unit-of-work";
import { syncSearchIndex } from "@/services/search/searchIndex";
import { mapTracks } from "@/types/track";
import type { TrackSortKey } from "@/modules/tracks/types";
import { ArtistId as createArtistId } from "@/types/ids";
import type { ArtistId } from "@/types/ids";
import { removeCoverCache, updateCoverCache } from "@/modules/covers/lib/cover-cache";
import { assertValidName } from "@/lib/limits";
import { sortTracks } from "./shared";
import { indexById, unique } from "@/lib/math";
import {
  purgeTracksInTx,
  syncAfterTrackPurge,
  TRACK_CASCADE_TABLES,
} from "./track-cascade";
import type { ArtistPageData } from "./types";
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

async function getArtistTrackEntities(artistId: ArtistId, sortKey: TrackSortKey | null) {
  // A local artist can absorb remote tracks via substitution — skip shadows.
  const artistTracks = await trackRepository.byArtist(artistId).members().rows();

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

export const artistTrackScope = (artistId: ArtistId): TrackScope => trackRepository.byArtist(artistId);

// The queue reads through getArtistPageData; the scope's own sort would order descending ties differently.
export const readArtistTracks = async (artistId: ArtistId, sortKey: TrackSortKey | null, limit: number): Promise<TrackEntity[]> =>
  (await getArtistTrackEntities(artistId, sortKey)).slice(0, limit);

export const readArtistAlbums = (artistId: ArtistId): Promise<AlbumEntity[]> =>
  albumRepository.findByArtistIdPaginated(artistId, 0, Infinity);

export async function createArtistAndSync(name = "New artist") {
  const now = Date.now();
  const artist: ArtistEntity = {
    id: createArtistId(crypto.randomUUID()),
    name: assertValidName(name, "artist"),
    pinned: 1,
    addedAt: now,
    updatedAt: now,
  };

  await artistRepository.create(artist);
  await syncSearchIndex({ artists: [artist.id] });

  return artist;
}

/** Recomputes the denormalized artistName of the artist's tracks. Dexie-only: safe inside a transaction. */
async function syncTrackArtistNames(uow: Scope<"tracks" | "counters" | "artists">, artistId: ArtistId, nextArtistName: string) {
  const tracks = await uow.tracks.byArtist(artistId).rows();

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
    await unitOfWork.run(["artists", "tracks", "counters"], async (uow) => {
      await uow.artists.update(currentArtist.id, updateData);
      if (updateData.name) {
        await syncTrackArtistNames(uow, currentArtist.id, nextArtist.name);
      }
    });

    const [albums, trackIds] = await Promise.all([
      albumRepository.findByArtistId(currentArtist.id),
      trackRepository.byArtist(currentArtist.id).ids(),
    ]);

    await syncSearchIndex({
      artists: [currentArtist.id],
      albums: albums.map(album => album.id),
      tracks: trackIds,
    });
  }

  return nextArtist;
}

/**
 * Deleting an artist always takes their albums. Their tracks are detached and
 * stay in the library by default; `deleteTracks` removes them instead — note
 * that includes tracks credited to a second artist too.
 */
export async function deleteArtistAndSync(
  artistEntity: ArtistEntity | null,
  options: { deleteTracks?: boolean } = {},
) {
  if (!artistEntity) {
    return;
  }

  const cascadeTracks = options.deleteTracks === true;
  const albums = await albumRepository.findByArtistId(artistEntity.id);
  const rawTracks = await trackRepository.byArtist(artistEntity.id).rows();
  const albumTracks = (await Promise.all(
    albums.map(album => trackRepository.inAlbum(album.id).rows()),
  )).flat();
  const affectedTracks = [...indexById([...rawTracks, ...albumTracks]).values()];
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

  await unitOfWork.run(
    TRACK_CASCADE_TABLES,
    async (uow) => {
      // The purge GCs albums that lost their last track; the artist's own
      // albums are dropped explicitly right after, empty or not.
      if (cascadeTracks) await purgeTracksInTx(uow, affectedTracks, now);

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
    },
  );
  if (cascadeTracks) await deleteOwnedFiles(affectedTracks);

  await syncAfterTrackPurge(cascadeTracks ? affectedTrackIds : []);

  for (const album of albums) {
    removeCoverCache("album", album.id);
  }
  await syncSearchIndex({
    artists: [artistEntity.id],
    albums: albums.map(album => album.id),
    tracks: cascadeTracks ? [] : affectedTrackIds,
  });

  removeCoverCache("artist", artistEntity.id);
}
