<template>
  <div class="text-sm opacity-80">
    <!-- Playlist -->
    <template v-if="isPlaylist(data)">
      <span v-if="data.ownerName">{{ data.ownerName }} · </span>
      <span>{{ t('media.trackCount', data.trackCount) }}</span>
      <span v-if="data.duration"> · {{ data.duration }}</span>
    </template>

    <!-- Artist -->
    <template v-else-if="isArtist(data)">
      <span>{{ formatListeners(data.monthlyListeners) }}</span>
    </template>

    <!-- Album -->
    <template v-else-if="isAlbum(data)">
      <RouterLink
        :to="`/artist/${data.artistId}`"
        class="hover:underline"
      >
        {{ data.artistName }}
      </RouterLink>
      <span> · {{ data.releaseYear }}</span>
      <span> · {{ t('media.trackCount', data.trackCount) }}</span>
      <span v-if="data.duration"> · {{ data.duration }}</span>
    </template>

    <!-- Liked -->
    <template v-else-if="isLiked(data)">
      <span>{{ t('media.trackCount', data.trackCount) }}</span>
      <span v-if="data.duration"> · {{ data.duration }}</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { isAlbum, isArtist, isLiked, isPlaylist, MediaData } from "./types";

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
