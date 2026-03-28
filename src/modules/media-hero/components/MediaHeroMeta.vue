<template>
  <div class="flex items-center flex-wrap gap-x-1 text-sm text-foreground/70 leading-relaxed">
    <template v-if="isPlaylist(data)">
      <span
        v-if="data.ownerName"
        class="font-medium text-foreground/90"
      >
        {{ data.ownerName }}
      </span>
      <span
        v-if="data.ownerName"
        class="opacity-60"
      >·</span>
      <span>{{ t('media.trackCount', data.trackCount) }}</span>
      <template v-if="data.duration">
        <span class="opacity-60">·</span>
        <span>{{ data.duration }}</span>
      </template>
    </template>

    <template v-else-if="isArtist(data)">
      <span>{{ formatListeners(data.monthlyListeners) }}</span>
    </template>

    <template v-else-if="isAlbum(data)">
      <RouterLink
        :to="`/artist/${data.artistId}`"
        class="font-medium text-white/90 hover:text-white hover:underline underline-offset-2 transition-colors duration-200"
      >
        {{ data.artistName }}
      </RouterLink>
      <span class="opacity-60">·</span>
      <span>{{ data.releaseYear }}</span>
      <span class="opacity-60">·</span>
      <span>{{ t('media.trackCount', data.trackCount) }}</span>
      <template v-if="data.duration">
        <span class="opacity-60">·</span>
        <span>{{ data.duration }}</span>
      </template>
    </template>

    <template v-else-if="isLiked(data)">
      <span>{{ t('media.trackCount', data.trackCount) }}</span>
      <template v-if="data.duration">
        <span class="opacity-60">·</span>
        <span>{{ data.duration }}</span>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { isAlbum, isArtist, isLiked, isPlaylist, MediaData } from "@/modules/media-hero/types";

defineProps<{
  data: MediaData;
}>();

const { t } = useI18n();

function formatListeners(count: number): string {
  if (count >= 1_000_000) {
    return t("media.monthlyListeners", { count: `${(count / 1_000_000).toFixed(1)}M` });
  }
  if (count >= 1_000) {
    return t("media.monthlyListeners", { count: `${(count / 1_000).toFixed(0)}K` });
  }
  return t("media.monthlyListeners", { count });
}
</script>
