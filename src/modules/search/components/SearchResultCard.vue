<template>
  <div
    class="relative flex flex-col gap-4 p-4 rounded-xl bg-muted/40
           hover:bg-muted/60 cursor-pointer transition-all duration-200 group
           min-h-[172px] select-none"
    @click="emit('click')"
  >
    <!-- Cover -->
    <div
      class="shrink-0 size-20 overflow-hidden shadow-lg"
      :class="item.type === 'artist' ? 'rounded-full' : 'rounded-lg'"
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
        class="size-full flex items-center justify-center bg-muted text-muted-foreground"
      >
        <component
          :is="typeIcon"
          class="size-8"
        />
      </div>
    </div>

    <!-- Text -->
    <div class="flex-1 min-w-0">
      <div class="font-bold text-xl leading-tight truncate">
        {{ item.title }}
      </div>
      <div class="flex items-center gap-1.5 mt-1.5 text-sm text-muted-foreground">
        <span
          class="bg-foreground/10 text-foreground font-medium text-xs px-2 py-0.5 rounded-full capitalize"
        >
          {{ typeLabel }}
        </span>
        <template v-if="item.artist && item.type !== 'artist'">
          <span class="opacity-40">·</span>
          <span class="truncate">{{ item.artist }}</span>
        </template>
      </div>
    </div>

    <!-- Hover play button -->
    <button
      class="absolute bottom-3 right-3 size-11 rounded-full bg-primary text-primary-foreground
             flex items-center justify-center shadow-lg
             opacity-0 group-hover:opacity-100
             translate-y-1 group-hover:translate-y-0
             transition-all duration-200"
      @click.stop="emit('play')"
    >
      <IconPlayerPlayFilled class="size-4.5 ml-0.5" />
    </button>
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
import IconPlayerPlayFilled from "~icons/tabler/player-play-filled";

const props = defineProps<{ item: SearchResultItem }>();
const emit = defineEmits<{ click: []; play: [] }>();
const { t } = useI18n();

const typeIcon = computed(() => {
  switch (props.item.type) {
    case "artist": return IconUser;
    case "album": return IconDisc;
    default: return IconMusic;
  }
});

const typeLabel = computed(() => {
  switch (props.item.type) {
    case "artist": return t("search.filter.artist");
    case "album": return t("search.filter.album");
    default: return t("search.filter.track");
  }
});
</script>
