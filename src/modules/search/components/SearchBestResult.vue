<template>
  <div
    class="group relative flex flex-col gap-4 p-4 rounded-xl bg-muted/40
           hover:bg-muted/70 cursor-pointer transition-colors duration-200 select-none"
    @click="emit('click')"
  >
    <!-- Cover -->
    <div
      class="relative shrink-0 size-24 overflow-hidden shadow-lg"
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
        class="size-full flex items-center justify-center bg-muted"
      >
        <component
          :is="typeIcon"
          class="size-10 text-muted-foreground"
        />
      </div>

      <!-- Play overlay -->
      <div
        class="absolute inset-0 flex items-center justify-center
               bg-black/40 opacity-0 group-hover:opacity-100
               transition-opacity duration-200 rounded-[inherit]"
      >
        <div class="size-8 rounded-full bg-primary flex items-center justify-center shadow-lg">
          <IconPlayerPlayFilled class="size-4 text-primary-foreground translate-x-px" />
        </div>
      </div>
    </div>

    <!-- Info -->
    <div class="flex-1 min-w-0">
      <p class="font-bold text-lg leading-tight truncate">
        {{ item.title }}
      </p>
      <div class="flex items-center gap-1.5 mt-1.5">
        <span
          class="px-2 py-0.5 rounded text-xs font-semibold bg-muted
                 text-muted-foreground capitalize tracking-wide"
        >
          {{ typeLabel }}
        </span>
        <span
          v-if="item.artist && item.type !== 'artist'"
          class="text-xs text-muted-foreground truncate"
        >
          {{ item.artist }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { SearchResultItem } from "@/modules/search/types";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import IconPlayerPlayFilled from "~icons/tabler/player-play-filled";
import IconMusic from "~icons/tabler/music";
import IconUser from "~icons/tabler/user";
import IconDisc from "~icons/tabler/disc";

const props = defineProps<{ item: SearchResultItem }>();
const emit = defineEmits<{ click: [] }>();

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
    case "track": return t("search.filter.track");
    default: return props.item.type;
  }
});
</script>
