import { queryOptions } from "@tanstack/vue-query";
import type { TrackId } from "@/types/ids";
import { getRecommendations } from "@/modules/recommendations/service/recommender.service";
import { queryKeys } from "./query-keys";

export const recommendationsQueries = {
  forTrack: (trackId: TrackId, limit = 8) =>
    queryOptions({
      queryKey: queryKeys.recommendations.forTrack(trackId, limit),
      queryFn: () => getRecommendations(trackId, limit),
      staleTime: 5 * 60 * 1000,
      enabled: Boolean(trackId),
    }),
} as const;
