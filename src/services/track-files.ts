import { db } from "@/db";
import type { TrackEntity } from "@/db/entities";
import { storageService } from "@/db/storage";
import { getLogger } from "@/lib/logger";

// Only relative paths under these folders live in app storage. A watched
// folder's track keeps an absolute path to the user's own file.
const AUDIO_DIR = "tracks/";
const LYRICS_DIR = "lyrics/";

const audioPathOf = (track: TrackEntity): string | null =>
  (track.storagePath?.startsWith(AUDIO_DIR) ? track.storagePath : null);

const lyricsPathOf = (track: TrackEntity): string | null =>
  (track.lyricsPath?.startsWith(LYRICS_DIR) ? track.lyricsPath : null);

/**
 * Deletes the files Audiogram owns for tracks whose rows are already gone:
 * the imported audio and an attached lyrics file. An audio path another row
 * still points at survives. A file that cannot be deleted is logged and
 * skipped; the rows are gone either way, so this never throws.
 */
export const deleteOwnedFiles = async (tracks: readonly TrackEntity[]): Promise<void> => {
  const audioPaths = [...new Set(tracks.map(audioPathOf).filter(path => path !== null))];
  const stillUsed = new Set(audioPaths.length > 0
    ? (await db.tracks.where("storagePath").anyOf(audioPaths).toArray()).map(track => track.storagePath)
    : []);
  const paths = [
    ...audioPaths.filter(path => !stillUsed.has(path)),
    ...tracks.map(lyricsPathOf).filter(path => path !== null),
  ];

  for (const path of paths) {
    const result = await storageService.deleteFile(path);
    if (result.isErr()) getLogger().warn(`[Tracks] Deleting ${path} failed: ${result.error.message}`);
  }
};

export const deleteOwnedLyricsFile = async (path: string): Promise<void> => {
  if (!path.startsWith(LYRICS_DIR)) return;
  const result = await storageService.deleteFile(path);
  if (result.isErr()) getLogger().warn(`[Tracks] Deleting ${path} failed: ${result.error.message}`);
};
