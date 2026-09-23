import { db } from "@/db";
import type { TrackEntity } from "@/db/entities";
import { playlistRepository, trackRepository } from "@/db/repositories";
import { unitOfWork } from "@/db/unit-of-work";
import { unwrapResult } from "@/queries/shared";
import { getLogger } from "@/lib/logger";
import { removeSearchDocuments } from "@/modules/search/service/searchIndex";
import type { AlbumId, ArtistId, TrackId } from "@/types/ids";
import type { SourceTrackDTO } from "@/types/source-dto";
import { sourceKindOfId } from "@/types/track-ref";
import { ensurePinned } from "./ensurePinned";

/** A shadow row carries everything the pin cascade needs to rebuild its family. */
const dtoFromRow = (track: TrackEntity): SourceTrackDTO => ({
  id: track.id,
  title: track.title,
  artistName: track.artistName || undefined,
  artistIds: track.artistIds.length > 0 ? track.artistIds : undefined,
  albumId: track.albumId || undefined,
  albumTitle: track.albumTitle || undefined,
  duration: track.duration,
  trackNo: track.trackNo,
  discNo: track.diskNo,
  format: track.format,
});

/**
 * Upgrades a shadow remote row to a full library member. A shadow row has no
 * album/artist rows, so this runs the same cascade as adding from a DTO.
 */
export async function promoteTrackToLibrary(trackId: TrackId): Promise<void> {
  const track = await unwrapResult(trackRepository.findById(trackId));
  if (!track) throw new Error(`Track not found: ${trackId}`);

  await ensurePinned({ kind: "remote", dto: dtoFromRow(track) });
}

/**
 * Remote counterpart of "Delete track": cascades playlists/like in one
 * unitOfWork; the row degrades to a shadow so history survives.
 */
export async function removeTrackFromLibrary(trackId: TrackId): Promise<void> {
  const result = await unitOfWork.runScoped(
    [db.tracks, db.albums, db.artists, db.playlists],
    async () => {
      const track = await unwrapResult(trackRepository.findById(trackId));

      const playlists = await unwrapResult(playlistRepository.findAll());
      for (const playlist of playlists) {
        if (!playlist.trackIds.includes(trackId)) continue;
        await unwrapResult(playlistRepository.update(playlist.id, {
          trackIds: playlist.trackIds.filter(id => id !== trackId),
        }));
      }

      await unwrapResult(trackRepository.update(trackId, { pinned: 0, likedAt: undefined }));

      // Album and artist rows exist only for library members, so the ones
      // this track was the last library reference of go with it.
      const removedDocIds: string[] = [];
      if (track?.albumId && await deleteAlbumIfUnreferenced(track.albumId)) {
        removedDocIds.push(`album:${track.albumId}`);
      }
      for (const artistId of new Set(track?.artistIds ?? [])) {
        if (await deleteArtistIfUnreferenced(artistId)) removedDocIds.push(`artist:${artistId}`);
      }
      return removedDocIds;
    },
  );
  if (result.isErr()) throw result.error;

  removeSearchDocuments([`track:${trackId}`, ...result.value]).catch((error) => {
    getLogger().warn(`[Search] De-indexing removed ${trackId} failed: ${String(error)}`);
  });
}

/** Runs inside the caller's transaction. True when a row was deleted. */
const deleteAlbumIfUnreferenced = async (albumId: AlbumId): Promise<boolean> => {
  const stillPinned = await db.tracks.where("[albumId+pinned]").equals([albumId, 1]).count();
  if (stillPinned > 0 || !(await db.albums.get(albumId))) return false;
  await db.albums.delete(albumId);
  return true;
};

/**
 * Runs inside the caller's transaction, after the album check, so an album
 * that just left no longer holds its artist. True when a row was deleted.
 */
const deleteArtistIfUnreferenced = async (artistId: ArtistId): Promise<boolean> => {
  const [pinnedTracks, albums] = await Promise.all([
    db.tracks.where("artistIds").equals(artistId).and(candidate => candidate.pinned === 1).count(),
    db.albums.where("artistId").equals(artistId).count(),
  ]);
  if (pinnedTracks > 0 || albums > 0) return false;

  // A source id stays on the shadow rows as a link to the source's catalog;
  // an unprefixed one would point at a library page that no longer exists.
  if (sourceKindOfId(artistId) === "local") {
    await db.tracks.where("artistIds").equals(artistId).modify((track) => {
      track.artistIds = track.artistIds.filter(id => id !== artistId);
    });
  }

  if (!(await db.artists.get(artistId))) return false;
  await db.artists.delete(artistId);
  return true;
};
