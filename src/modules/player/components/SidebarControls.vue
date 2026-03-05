<template>
  <div class="flex min-w-[180px] w-[30%] justify-end pr-1">
    <div class="flex w-full gap-0.5 justify-end items-center grow">
      <div class="text-sm font-medium text-foreground/50  whitespace-nowrap mr-2 flex items-center">
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
        <IconCategory
          class="size-4.5"
        />
      </Button>

      <Popover :modal="false">
        <PopoverTrigger as-child>
          <Button
            size="icon-sm"
            variant="ghost"
          >
            <IconPlaylist
              class="size-4.5"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent

          align="center"
          side="top"
          :side-offset="32"
          class="w-80 p-0 h-[82dvh] mr-2"
        >
          <QueueList />
        </PopoverContent>
      </Popover>

      <!-- <PIPTrigger /> -->
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
import IconCategory from "~icons/tabler/category";

// import PIPTrigger from "@/components/pip/PIPTrigger.vue";
import VolumeButton from "./actions/VolumeButton.vue";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { computed } from "vue";
import QueueList from "@/modules/queue/components/QueueList.vue";

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
