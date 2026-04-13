<template>
  <div
    ref="dropZoneRef"
    class="flex bg-muted dark:bg-background flex-col h-dvh overflow-hidden antialiased"
    :style="{
      paddingTop: top,
      paddingRight: right,
      paddingBottom: bottom,
      paddingLeft: left,
    }"
  >
    <DropOverlay :show="isDragging" />

    <main class="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
      <slot />
    </main>

    <MiniPlayer
      v-if="playerStore.currentTrack"
      @click="isFullPlayerOpen = true"
    />

    <MobileTabBar v-if="!route.meta.hideTabBar" />

    <Transition name="full-player">
      <div
        v-if="isFullPlayerOpen"
        class="fixed inset-0 bg-background z-40"
      >
        <div class="flex flex-col h-full">
          <div class="flex items-center justify-between p-4">
            <Button
              variant="ghost"
              size="icon-sm"
              @click="isFullPlayerOpen = false"
            >
              <IconChevronDown class="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled
            >
              <IconQueue class="size-5" />
            </Button>
          </div>
          <MobileFullPlayer class="flex-1 min-h-0" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRoute } from "vue-router";
import { useScreenSafeArea } from "@vueuse/core";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useFileDrop } from "@/composables/useFileDrop";
import DropOverlay from "@/components/DropOverlay.vue";
import MobileTabBar from "@/components/layout/mobile/MobileTabBar.vue";
import MiniPlayer from "@/components/layout/mobile/MiniPlayer.vue";
import MobileFullPlayer from "@/components/layout/mobile/MobileFullPlayer.vue";
import { Button } from "@/components/ui/button";
import IconChevronDown from "~icons/tabler/chevron-down";
import IconQueue from "~icons/tabler/list";

const route = useRoute();
const playerStore = usePlayerStore();
const isFullPlayerOpen = ref(false);

const { isDragging } = useFileDrop({
  acceptedExtensions: [".mp3", ".flac", ".wav", ".ogg"],
  onDrop: (files) => {
    console.log("Dropped:", files);
  },
});

const { top, right, bottom, left } = useScreenSafeArea();
</script>
