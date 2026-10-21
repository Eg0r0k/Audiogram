<template>
  <div
    v-if="stacked"
    class="flex flex-col items-start gap-1 text-left text-sm"
  >
    <RouterLink
      v-if="person?.to"
      :to="person.to"
      class="font-semibold text-white hover:underline underline-offset-2"
    >
      {{ person.name }}
    </RouterLink>
    <span
      v-else-if="person"
      class="font-semibold text-white"
    >
      {{ person.name }}
    </span>

    <div class="flex flex-wrap items-center gap-x-1 text-white/70">
      <template
        v-for="(part, index) in stackedDetails"
        :key="index"
      >
        <span
          v-if="index > 0"
          class="opacity-60"
        >·</span>
        <span>{{ part }}</span>
      </template>
    </div>
  </div>

  <div
    v-else
    class="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-center text-sm leading-relaxed text-foreground/70 @lg:justify-start @lg:text-left"
  >
    <RouterLink
      v-if="person?.to"
      :to="person.to"
      class="font-semibold text-white hover:underline underline-offset-2"
    >
      {{ person.name }}
    </RouterLink>
    <span
      v-else-if="person"
      class="font-semibold text-white"
    >
      {{ person.name }}
    </span>

    <template
      v-for="(part, index) in details"
      :key="index"
    >
      <span
        v-if="index > 0 || person"
        class="opacity-60"
      >·</span>
      <span>{{ part }}</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import type { RouteLocationRaw } from "vue-router";
import { routeLocation, wantsCatalogView } from "@/app/router/route-locations";
import type { MediaData } from "@/types/media-data";
import { isAlbum, isArtist, isLiked, isPlaylist } from "@/types/media-data";

const props = defineProps<{
  data: MediaData;
  /** Mobile hero: the person on a line of its own, the details below it led by the type. */
  stacked?: boolean;
  typeLabel?: string;
}>();

// Following an artist link out of a catalog album stays in that catalog:
// the album was the source's view, so its artist should be too.
const route = useRoute();
const artistIntent = computed(() => ({ catalog: wantsCatalogView(route.query) }));

const { t } = useI18n();

const formatListeners = (count: number): string => {
  if (count >= 1_000_000) {
    return t("media.monthlyListeners", { count: `${(count / 1_000_000).toFixed(1)}M` });
  }
  if (count >= 1_000) {
    return t("media.monthlyListeners", { count: `${(count / 1_000).toFixed(0)}K` });
  }
  return t("media.monthlyListeners", { count });
};

const person = computed((): { name: string; to?: RouteLocationRaw } | null => {
  const data = props.data;
  if (isAlbum(data)) return { name: data.artistName, to: routeLocation.artist(data.artistId, artistIntent.value) };
  if (isPlaylist(data) && data.ownerName) return { name: data.ownerName };
  return null;
});

const details = computed((): string[] => {
  const data = props.data;
  const withDuration = (parts: string[], duration?: string) => (duration ? [...parts, duration] : parts);
  if (isAlbum(data)) {
    const year = data.releaseYear ? [String(data.releaseYear)] : [];
    return withDuration([...year, t("common.trackCount", data.trackCount)], data.duration);
  }
  if (isArtist(data)) return [formatListeners(data.monthlyListeners)];
  if (isPlaylist(data) || isLiked(data)) return withDuration([t("common.trackCount", data.trackCount)], data.duration);
  return [];
});

const stackedDetails = computed(() => (props.typeLabel ? [props.typeLabel, ...details.value] : details.value));
</script>
