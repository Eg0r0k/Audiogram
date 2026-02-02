<template>
  <div class="flex min-w-[180px] w-[30%] justify-end pr-1">
    <div class="flex w-full gap-0.5 justify-end items-center grow">
      <div class="text-xs text-muted-foreground font-mono whitespace-nowrap mr-2 flex items-center tabular-nums">
        <span>{{ timeDisplay.current }}</span>
        <span class="mx-1">/</span>
        <span :class="{ 'text-red-500 font-semibold': playerStore.isLiveStream }">
          {{ timeDisplay.duration }}
        </span>
      </div>
      <VolumeButton />
      <!-- <Button
        size="icon-sm"
        variant="ghost"
      >
        <IconDeviceSpeaker
          class="size-4.5"
        />
      </Button> -->
      <Button
        size="icon-sm"
        variant="ghost"
      >
        <IconPlaylist
          class="size-4.5"
        />
      </Button>

      <Popover>
        <PopoverTrigger as-child>
          <Button
            size="icon-sm"
            variant="ghost"
          >
            <IconDots
              class="size-4.5"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="center"
          side="top"
          :side-offset="32"
          class="w-90 p-0! mr-2"
        >
          <Equalizer />
        </PopoverContent>
      </Popover>

      <!-- <Button
        size="icon-sm"
        variant="ghost"
      >
        <IconDevices2
          class="size-4.5"
        />
      </Button> -->
      <!-- <PIPTrigger />
      <FullscreenTrigger /> -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import IconPlaylist from "~icons/tabler/playlist";
// import IconDevices2 from "~icons/tabler/devices-2";
// import IconDeviceSpeaker from "~icons/tabler/device-speaker-filled";
import IconDots from "~icons/tabler/dots";

// import PIPTrigger from "@/components/pip/PIPTrigger.vue";
// import FullscreenTrigger from "@/components/layout/fullscreen/FullscreenTrigger.vue";
import VolumeButton from "./actions/VolumeButton.vue";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { computed } from "vue";
import Equalizer from "./eq/Equalizer.vue";

const playerStore = usePlayerStore();

const formatTime = (s: number): string => {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const timeDisplay = computed(() => {
  if (playerStore.isLiveStream) return { current: "🔴", duration: "LIVE" };
  return {
    current: formatTime(playerStore.currentTime),
    duration: formatTime(playerStore.duration),
  };
});

</script>
