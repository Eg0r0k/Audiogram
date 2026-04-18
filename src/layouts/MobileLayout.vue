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
          background: activeTab === 'player'
            ? `linear-gradient(to bottom, ${playerColor.hsl}, black)`
            : 'var(--background)',
          top: IS_TAURI && !IS_MOBILE ? '26px' : '0px',
          bottom: '0', left: '0', right: '0',
          paddingBottom: bottom,
        }"
      >
        <Tabs
          v-model="activeTab"
          class="flex flex-col h-full "
        >
          <div class="flex items-center justify-between px-4 pt-2 shrink-0 ">
            <Button
              variant="ghost"
              size="icon-sm"
              :class="activeTab === 'player' ? 'text-white/80 hover:text-white' : ''"
              @click="isFullPlayerOpen = false"
            >
              <IconChevronDown class="size-5" />
            </Button>

            <TabsList>
              <TabsTrigger
                value="player"
                class="text-white/60 data-[state=active]:bg-white/20 data-[state=active]:text-white"
              >
                {{ $t('player.nowPlaying') }}
              </TabsTrigger>
              <TabsTrigger
                value="queue"
                class="text-white/60 data-[state=active]:bg-white/20 data-[state=active]:text-white"
              >
                {{ $t('queue.title') }}
              </TabsTrigger>
            </TabsList>

            <div class="w-8" />
          </div>

          <TabsContent
            value="player"
            class="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden"
          >
            <MobileFullPlayer class="h-full" />
          </TabsContent>

          <TabsContent
            value="queue"
            class="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden"
          >
            <QueueList class="h-full" />
          </TabsContent>
        </Tabs>
      </div>
    </Transition>
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
import QueueList from "@/modules/queue/components/QueueList.vue";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import IconChevronDown from "~icons/tabler/chevron-down";
import WindowToolbar from "@/components/WindowToolbar.vue";
import { IS_MOBILE, IS_TAURI } from "@/lib/environment/userAgent";

const playerStore = usePlayerStore();
const { color: playerColor } = useMobilePlayerColor();

const isFullPlayerOpen = ref(false);
const activeTab = ref<"player" | "queue">("player");

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

watch(isFullPlayerOpen, (open) => {
  if (!open) activeTab.value = "player";
});

const { isDragging } = useFileDrop({
  acceptedExtensions: [".mp3", ".flac", ".wav", ".ogg"],
  onDrop: files => console.log("Dropped:", files),
});

const { top, right, bottom, left } = useScreenSafeArea();
</script>
