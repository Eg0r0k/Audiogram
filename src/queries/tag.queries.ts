import type { TagEntity, TrackEntity } from "@/db/entities";
import { tagRepository, trackRepository } from "@/db/repositories";
import type { TagId } from "@/types/ids";

export async function addTagToTrackAndSync(
  track: TrackEntity,
  tagName: string,
): Promise<TagEntity> {
  const tag = await tagRepository.findOrCreate(tagName);

  if (!track.tagIds.includes(tag.id)) {
    await trackRepository.addTagToTrack(track.id, tag.id);
  }

  return tag;
}

export async function removeTagFromTrackAndSync(
  track: TrackEntity,
  tagId: TagId,
): Promise<void> {
  await trackRepository.removeTagFromTrack(track.id, tagId);
}
