import type { AlbumEntity, TrackEntity } from "@/db/entities";
import {
  albumRepository,
  artistRepository,
  coverRepository,
  trackRepository,
} from "@/db/repositories";
import { DbError } from "@/db/errors/db.errors";
import type { TrackScope } from "@/db/repositories/track.scope";
import { unitOfWork } from "@/db/unit-of-work";
import { syncSearchIndex } from "@/services/search/searchIndex";
import { mapTracks } from "@/types/track";
import type { TrackSortKey } from "@/modules/tracks/types";
import { AlbumId as createAlbumId } from "@/types/ids";
import type { AlbumId, ArtistId, TrackId } from "@/types/ids";
import { removeCoverCache, updateCoverCache } from "@/modules/covers/lib/cover-cache";
import { assertValidName } from "@/lib/limits";
import { sortTracks } from "./shared";
import { unique } from "@/lib/math";
import {
  purgeTracksInTx,
  syncAfterTrackPurge,
  TRACK_CASCADE_TABLES,
} from "./track-cascade";
import type { AlbumPageData } from "./types";
import { deleteOwnedFiles } from "@/services/track-files";

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

const byDiscAndTrack = (a: TrackEntity, b: TrackEntity): number =>
  (a.diskNo ?? 1) - (b.diskNo ?? 1) || (a.trackNo ?? 0) - (b.trackNo ?? 0);

async function getAlbumTrackEntities(albumId: AlbumId, sortKey: TrackSortKey | null) {
  // Shadow rows (a liked catalog track next to its downloaded copy) are not listed.
  const albumTracks = (await trackRepository.inAlbum(albumId).members().rows())
    .sort(byDiscAndTrack);

  if (!sortKey) {
    return albumTracks;
  }

  return sortTracks(albumTracks, sortKey);
}

export const albumTrackScope = (albumId: AlbumId): TrackScope => trackRepository.inAlbum(albumId);

// The album order is not an index order, so a limited read still sorts every row of the album first.
export const readAlbumTracks = async (albumId: AlbumId, sortKey: TrackSortKey | null, limit: number): Promise<TrackEntity[]> =>
  (await getAlbumTrackEntities(albumId, sortKey)).slice(0, limit);

export async function createAlbumAndSync(
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
  await syncSearchIndex({ albums: [album.id] });

  return album;
}

export async function updateAlbumAndSync(
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
    await unitOfWork.run(["albums", "tracks", "counters"], async (uow) => {
      await uow.albums.update(currentAlbum.id, { title });
      await uow.tracks.inAlbum(currentAlbum.id).modify({ albumTitle: title });
    });

    updatedTrackIds = await trackRepository.inAlbum(currentAlbum.id).ids();

    didUpdateAlbum = true;
  }

  if (didUpdateAlbum) {
    await syncSearchIndex({ albums: [currentAlbum.id], tracks: updatedTrackIds });
  }

  return nextAlbum;
}

/**
 * `deleteTracks` cascades the album's tracks and their playlist references in
 * one transaction; search and their files are dealt with strictly after it. Without it the
 * album only ungroups — its tracks stay in the library, remote ones included,
 * keeping whatever is downloaded.
 */
export async function deleteAlbumAndSync(
  albumEntity: AlbumEntity | null,
  options: { deleteTracks?: boolean } = {},
) {
  if (!albumEntity) {
    return;
  }

  const rawTracks = await trackRepository.inAlbum(albumEntity.id).rows();
  const cascadeTracks = options.deleteTracks === true;
  const trackIds = rawTracks.map(track => track.id);
  const now = Date.now();

  await unitOfWork.run(
    TRACK_CASCADE_TABLES,
    async (uow) => {
      // An empty shadow album (0 tracks) is deleted explicitly below.
      if (cascadeTracks) await purgeTracksInTx(uow, rawTracks, now);

      if (!cascadeTracks && rawTracks.length > 0) {
        // Detach fully — a dangling albumId would keep pointing at a dead row.
        await uow.tracks.updateMany(rawTracks.map(track => ({
          key: track.id,
          changes: { albumTitle: "", albumId: createAlbumId("") },
        })));
      }

      await uow.covers.deleteAlbumCover(albumEntity.id);
      await uow.albums.delete(albumEntity.id);
    },
  );
  if (cascadeTracks) await deleteOwnedFiles(rawTracks);

  await syncAfterTrackPurge(cascadeTracks ? trackIds : []);
  await syncSearchIndex({ albums: [albumEntity.id], tracks: cascadeTracks ? [] : trackIds });

  removeCoverCache("album", albumEntity.id);
}
