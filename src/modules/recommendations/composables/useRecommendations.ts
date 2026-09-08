import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { toValue, type MaybeRef } from "vue";
import type { TrackId } from "@/types/ids";
import { recommendationsQueries } from "@/queries/recommendations.queries";

export function useTrackRecommendations(
  trackId: MaybeRef<TrackId | null | undefined>,
  limit = 8,
) {
  const queryConfig = computed(() => {
    const id = toValue(trackId);
    if (!id) {
      return { ...recommendationsQueries.forTrack("" as TrackId), enabled: false };
    }
    return recommendationsQueries.forTrack(id, limit);
  });

  const { data, isLoading, error } = useQuery(queryConfig);

  return {
    recommendations: computed(() => data.value ?? []),
    isLoading,
    error,
    hasAudioFeatures: computed(() =>
      (data.value ?? []).some(r => r.breakdown.audioSimilarity !== null),
    ),
  };
}
