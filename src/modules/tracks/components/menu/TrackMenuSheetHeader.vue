<template>
  <div class="flex items-center gap-3 px-4 pt-2 pb-3">
    <NuxtImage
      :src="coverUrl"
      :alt="track.title"
      :width="48"
      :height="48"
      fallback-src="/img/fallback.svg"
      class="size-12 shrink-0 rounded object-cover"
    />
    <div class="min-w-0 flex-1">
      <DrawerTitle class="truncate">
        {{ track.title }}
      </DrawerTitle>
      <DrawerDescription class="truncate">
        {{ track.artist }}
      </DrawerDescription>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import type { PlayerTrack, Track } from "@/modules/player/types";
import { useTrackRowCover } from "@/modules/tracks/composables/useTrackRowCover";

const props = defineProps<{
  track: PlayerTrack;
}>();

const coverUrl = useTrackRowCover(() => props.track as Track);
</script>
