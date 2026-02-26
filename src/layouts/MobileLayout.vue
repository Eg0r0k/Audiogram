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
      @click="openFullPlayer"
    />

    <MobileTabBar v-if="!route.meta.hideTabBar" />

    <Drawer
      v-model:open="isFullPlayerOpen"
      direction="bottom"
      :should-scale-background="false"
    >
      <DrawerContent class="min-h-[98dvh] ">
        <MobileFullPlayer
          class="flex-1 min-h-0"
          @close="isFullPlayerOpen = false"
        />
      </DrawerContent>
    </Drawer>
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
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

const route = useRoute();
const playerStore = usePlayerStore();
const isFullPlayerOpen = ref(false);

const openFullPlayer = () => {
  isFullPlayerOpen.value = true;
};

const { isDragging } = useFileDrop({
  acceptedExtensions: [".mp3", ".flac", ".wav", ".ogg"],
  onDrop: (files) => {
    console.log("Dropped:", files);
  },
});

const { top, right, bottom, left } = useScreenSafeArea();
</script>
