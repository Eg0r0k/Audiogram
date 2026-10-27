import { trackChaptersRepository } from "@/db/repositories/trackChapters.repository";
import type { TrackChapterMark } from "@/db/entities";
import type { TrackId } from "@/types/ids";

export const readTrackChapters = async (trackId: TrackId): Promise<TrackChapterMark[]> => {
  // Ephemeral tracks all map to the empty id: never any chapters.
  if (!trackId) return [];
  const entity = await trackChaptersRepository.findById(trackId);
  return entity?.chapters ?? [];
};

export async function saveTrackChapters(
  trackId: TrackId,
  chapters: TrackChapterMark[],
): Promise<void> {
  const clean = chapters.map(c => ({
    time: c.time,
    ...(c.title !== undefined ? { title: c.title } : {}),
  }));
  await trackChaptersRepository.setForTrack(trackId, clean);
}
