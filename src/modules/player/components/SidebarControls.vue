<template>
  <div class="flex min-w-[180px] w-[30%] justify-end pr-1">
    <div class="flex w-full gap-0.5 justify-end items-center grow">
      <div class="text-sm font-medium select-none text-muted-foreground  whitespace-nowrap mr-2 flex items-center">
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

      <Popover
        :modal="false"
        :open="isQueueOpen"
      >
        <PopoverTrigger as-child>
          <Button
            size="icon-sm"
            variant="ghost"
            @click="isQueueOpen = !isQueueOpen"
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
import { computed, ref } from "vue";
import QueueList from "@/modules/queue/components/QueueList.vue";
import { formatDuration } from "@/lib/format/time";

const playerStore = usePlayerStore();
const isQueueOpen = ref(false);

const timeDisplay = computed(() => {
  if (playerStore.isLiveStream) return { current: "🔴", duration: "LIVE" };
  return {
    current: formatDuration(playerStore.currentTime),
    duration: formatDuration(playerStore.duration),
  };
});

</script>
