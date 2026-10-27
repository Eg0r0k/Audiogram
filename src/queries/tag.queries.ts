import type { TagEntity, TrackEntity } from "@/db/entities";
import { tagRepository, trackRepository } from "@/db/repositories";
import { queryKeys } from "@/queries/query-keys";
import type { TrackId, TagId } from "@/types/ids";
import { queryOptions } from "@tanstack/vue-query";

export async function getAllTags(): Promise<TagEntity[]> {
  return tagRepository.findAll();
}

export async function getTagsByTrackId(trackId: TrackId): Promise<TagEntity[]> {
  return tagRepository.findByTrackId(trackId);
}

export const tagQueries = {
  all: () =>
    queryOptions({
      queryKey: queryKeys.tags.all(),
      queryFn: getAllTags,
    }),
  byTrack: (trackId: TrackId) =>
    queryOptions({
      queryKey: queryKeys.tags.byTrack(trackId),
      queryFn: () => getTagsByTrackId(trackId),
    }),
} as const;

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
