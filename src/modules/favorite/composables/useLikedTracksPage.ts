import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import { formatTotalDuration } from "@/lib/format/time";
import type { LikedData } from "@/modules/media-hero/types";
import { trackQueries } from "@/queries/track.queries";

export function useLikedTracksPage() {
  const { t } = useI18n();

  const {
    data: likedTracksData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery(trackQueries.likedPage());

  const tracks = computed(() => likedTracksData.value?.tracks ?? []);

  const totalDuration = computed(() => {
    const seconds = tracks.value.reduce((sum, track) => sum + track.duration, 0);
    return formatTotalDuration(seconds, t);
  });

  const likedData = computed<LikedData>(() => ({
    type: "liked",
    title: t("common.favorite"),
    image: "/img/liked-fallback.jpg",
    trackCount: tracks.value.length,
    duration: totalDuration.value,
  }));

  return {
    tracks,
    likedData,
    totalDuration,
    isLoading,
    isError,
    error,
    refetch,
  };
}
