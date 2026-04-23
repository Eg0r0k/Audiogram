<template>
  <div
    ref="dropZoneRef"
    class="flex bg-muted dark:bg-card flex-col h-dvh overflow-hidden antialiased"
    :style="{ paddingTop: top, paddingRight: right, paddingBottom: bottom, paddingLeft: left }"
  >
    <WindowToolbar class="toolbar" />
    <DropOverlay :show="isDragging" />

    <main
      class="flex-1 overflow-y-auto overflow-x-hidden min-h-0"
    >
      <slot />
    </main>

    <MiniPlayer
      v-if="playerStore.currentTrack"
      class="my-1"
      @click="isFullPlayerOpen = true"
    />

    <Transition name="full-player">
      <div
        v-if="isFullPlayerOpen"
        class="fixed z-50"
        :style="{
          background: `linear-gradient(to bottom, ${playerColor.hsl}, black)`,
          top: IS_TAURI && !IS_MOBILE ? '26px' : '0px',
          bottom: '0', left: '0', right: '0',
          paddingBottom: bottom,
        }"
      >
        <div class="flex h-full flex-col">
          <div class="flex items-center justify-between px-4 pt-2 shrink-0">
            <Button
              variant="ghost"
              size="icon-sm"
              class="text-white/80 hover:text-white"
              @click="isFullPlayerOpen = false"
            >
              <IconChevronDown class="size-5" />
            </Button>

            <div class="text-sm font-medium text-white/70">
              {{ $t('player.nowPlaying') }}
            </div>

            <div class="w-8" />
          </div>

          <div class="min-h-0 flex-1">
            <MobileFullPlayer class="h-full" />
          </div>
        </div>
      </div>
    </Transition>

    <MobileRightPanel />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useScreenSafeArea } from "@vueuse/core";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useFileDrop } from "@/composables/useFileDrop";
import { useMobilePlayerColor } from "@/composables/useMobilePlayerColor";
import DropOverlay from "@/components/DropOverlay.vue";
import MiniPlayer from "@/components/layout/mobile/MiniPlayer.vue";
import MobileFullPlayer from "@/components/layout/mobile/MobileFullPlayer.vue";
import { Button } from "@/components/ui/button";
import MobileRightPanel from "@/modules/right-panel/components/MobileRightPanel.vue";
import IconChevronDown from "~icons/tabler/chevron-down";
import WindowToolbar from "@/components/WindowToolbar.vue";
import { IS_MOBILE, IS_TAURI } from "@/lib/environment/userAgent";

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
  if (!track && isFullPlayerOpen.value) isFullPlayerOpen.value = false;
});

const { isDragging } = useFileDrop({
  acceptedExtensions: [".mp3", ".flac", ".wav", ".ogg"],
  onDrop: files => console.log("Dropped:", files),
});

const { top, right, bottom, left } = useScreenSafeArea();
</script>
