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

    <main
      class="flex-1 overflow-y-auto overflow-x-hidden min-h-0"
      :class="playerStore.currentTrack ? 'pb-[120px]' : 'pb-14'"
    >
      <slot />
    </main>

    <div class="fixed z-50 bottom-0 w-full ">
      <MiniPlayer
        v-if="playerStore.currentTrack"
        class="mb-2 "
        @click="isFullPlayerOpen = true"
      />

      <MobileTabBar
        v-if="!route.meta.hideTabBar"
      />
    </div>

    <Transition name="full-player">
      <div
        v-if="isFullPlayerOpen"
        class="fixed inset-0 z-50 transition-colors duration-300"
        :style="{ background: `linear-gradient(to bottom, ${playerColor.hsl}, black)` }"
      >
        <div class="flex flex-col h-full">
          <div class="flex items-center justify-between p-4">
            <Button
              variant="ghost"
              size="icon-sm"
              class="text-white"
              @click="isFullPlayerOpen = false"
            >
              <IconChevronDown class="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              class="text-white"
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
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useScreenSafeArea } from "@vueuse/core";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useFileDrop } from "@/composables/useFileDrop";
import { useMobilePlayerColor } from "@/composables/useMobilePlayerColor";
import DropOverlay from "@/components/DropOverlay.vue";
import MobileTabBar from "@/components/layout/mobile/MobileTabBar.vue";
import MiniPlayer from "@/components/layout/mobile/MiniPlayer.vue";
import MobileFullPlayer from "@/components/layout/mobile/MobileFullPlayer.vue";
import { Button } from "@/components/ui/button";
import IconChevronDown from "~icons/tabler/chevron-down";
import IconQueue from "~icons/tabler/list";

const route = useRoute();
const playerStore = usePlayerStore();
const { color: playerColor } = useMobilePlayerColor();

const isFullPlayerOpen = ref(false);

const closeFullPlayer = () => {
  isFullPlayerOpen.value = false;
};

const openFullPlayer = () => {
  isFullPlayerOpen.value = true;
};

defineExpose({ open: openFullPlayer, close: closeFullPlayer });

watch(() => playerStore.currentTrack, (track) => {
  if (!track && isFullPlayerOpen.value) {
    isFullPlayerOpen.value = false;
  }
});

const { isDragging } = useFileDrop({
  acceptedExtensions: [".mp3", ".flac", ".wav", ".ogg"],
  onDrop: (files) => {
    console.log("Dropped:", files);
  },
});

const { top, right, bottom, left } = useScreenSafeArea();
</script>
