<template>
  <div class="px-4">
    <div
      v-if="pinned.length > 0"
      class="mb-6"
    >
      <div class="flex items-center gap-1.5 px-3 mb-2">
        <IconPinFilled class="size-3.5 text-muted-foreground" />
        <span class="text-xs font-medium text-muted-foreground">
          {{ $t('library.pinned') }}
        </span>
      </div>
      <div class="library-grid">
        <MediaCard
          v-for="item in pinned"
          :key="`${item.type}:${item.id}`"
          :title="item.title"
          :subtitle="item.subtitle"
          :image="item.coverUrl"
          :to="item.to"
          :rounded="item.rounded"
          @play="$emit('play', item)"
          @contextmenu="$emit('contextmenu', $event, item)"
        />
      </div>
    </div>

    <div
      v-if="unpinned.length > 0"
      class="library-grid"
    >
      <MediaCard
        v-for="item in unpinned"
        :key="`${item.type}:${item.id}`"
        :title="item.title"
        :subtitle="item.subtitle"
        :image="item.coverUrl"
        :to="item.to"
        :rounded="item.rounded"
        @play="$emit('play', item)"
        @contextmenu="$emit('contextmenu', $event, item)"
      />
    </div>

    <div
      v-if="pinned.length === 0 && unpinned.length === 0 && !isLoading"
      class="flex flex-col items-center justify-center py-20 text-center"
    >
      <IconMusicOff class="size-12 text-muted-foreground mb-4" />
      <p class="text-2xl font-bold mb-1">
        {{ $t('library.empty') }}
      </p>
      <p class="text-lg text-muted-foreground">
        {{ $t('library.emptyDescription') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import IconPinFilled from "~icons/tabler/pin-filled";
import IconMusicOff from "~icons/tabler/music-off";
import type { LibraryItem } from "../types";
import MediaCard from "@/components/media-hero/MediaCard.vue";

defineProps<{
  pinned: LibraryItem[];
  unpinned: LibraryItem[];
  isLoading: boolean;
}>();

defineEmits<{
  play: [item: LibraryItem];
  contextmenu: [event: MouseEvent, item: LibraryItem];
}>();
</script>

<style scoped>
.library-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}
</style>
