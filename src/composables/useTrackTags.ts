import { useQuery, useMutation } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRef } from "vue";
import { tagQueries, addTagToTrackAndSync, removeTagFromTrackAndSync } from "@/queries/tag.queries";
import type { TrackEntity } from "@/db/entities";
import type { TagId } from "@/types/ids";
import type { QueryClient } from "@tanstack/vue-query";

export function useTrackTags(
  track: MaybeRef<TrackEntity>,
  queryClient: QueryClient,
) {
  const trackId = computed(() => toValue(track).id);

  const { data: tags, isLoading, refetch } = useQuery(
    computed(() => tagQueries.byTrack(trackId.value)),
  );

  const addTagMutation = useMutation({
    mutationFn: (tagName: string) =>
      addTagToTrackAndSync(queryClient, toValue(track), tagName),
    onError: (error) => {
      console.error("Failed to add tag", error);
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: (tagId: TagId) =>
      removeTagFromTrackAndSync(queryClient, toValue(track), tagId),
    onError: (error) => {
      console.error("Failed to remove tag", error);
    },
  });

  const addTag = (name: string) => {
    return addTagMutation.mutateAsync(name);
  };

  const removeTag = (tagId: TagId) => {
    return removeTagMutation.mutateAsync(tagId);
  };

  return {
    tags: computed(() => tags.value ?? []),
    isLoading,
    addTag,
    removeTag,
    refetch,
  };
}
