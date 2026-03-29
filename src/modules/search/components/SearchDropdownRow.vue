<template>
  <div
    class="group flex items-center gap-3 px-2.5 rounded-md cursor-pointer select-none
           hover:bg-muted/50 transition-colors duration-150
           h-14"
    @click="emit('click')"
  >
    <!-- Cover -->
    <div
      class="shrink-0 size-10 overflow-hidden bg-muted"
      :class="item.type === 'artist' ? 'rounded-full' : 'rounded'"
    >
      <NuxtImage
        v-if="item.coverPath"
        :src="item.coverPath"
        :alt="item.title"
        fallback-src="/img/fallback.svg"
        class="size-full object-cover"
      />
      <div
        v-else
        class="size-full flex items-center justify-center text-muted-foreground"
      >
        <component
          :is="typeIcon"
          class="size-4"
        />
      </div>
    </div>

    <!-- Info -->
    <div class="flex-1 min-w-0 flex flex-col">
      <span class="font-medium truncate text-sm leading-snug">{{ item.title }}</span>
      <div class="flex items-center gap-1 text-xs text-muted-foreground truncate mt-0.5">
        <!-- Artist name (for tracks, albums, playlists) -->
        <template v-if="item.artist && item.type !== 'artist'">
          <span class="truncate">{{ item.artist }}</span>
        </template>
        <!-- Album name (only for tracks) -->
        <template v-if="item.album && item.type === 'track'">
          <span class="opacity-40 shrink-0">·</span>
          <span class="truncate">{{ item.album }}</span>
        </template>
        <!-- Type label for playlists without artist -->
        <template v-if="item.type === 'playlist' && !item.artist">
          <span class="truncate capitalize">{{ typeLabel }}</span>
        </template>
        <!-- Type label for artists -->
        <template v-if="item.type === 'artist'">
          <span class="truncate capitalize">{{ typeLabel }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { SearchResultItem } from "@/modules/search/types";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import IconMusic from "~icons/tabler/music";
import IconUser from "~icons/tabler/user";
import IconDisc from "~icons/tabler/disc";
import IconPlaylist from "~icons/tabler/playlist";

const props = defineProps<{
  item: SearchResultItem;
}>();

const emit = defineEmits<{
  click: [];
}>();

const { t } = useI18n();

const typeIcon = computed(() => {
  switch (props.item.type) {
    case "artist":
      return IconUser;
    case "album":
      return IconDisc;
    case "playlist":
      return IconPlaylist;
    case "track":
    default:
      return IconMusic;
  }
});

const typeLabel = computed(() => {
  switch (props.item.type) {
    case "artist":
      return t("search.filter.artist");
    case "album":
      return t("search.filter.album");
    case "playlist":
      return t("search.filter.playlist");
    case "track":
    default:
      return t("search.filter.track");
  }
});
</script>
