<template>
  <div class="max-w-[722px] w-[40%]">
    <div class="flex flex-col w-full">
      <div class="flex gap-4 items-center  w-full">
        <div class="flex flex-1 gap-2 justify-end">
          <Button
            class="rounded-full"
            size="icon"
            variant="ghost"
          >
            <IconArrowsShuffle2 class="size-4.5" />
          </Button>
          <Button
            class="rounded-full"
            size="icon"
            variant="ghost"
          >
            <IconPlayerTrackPrevFilled class="size-5" />
          </Button>
        </div>

        <PlayButton />

        <div class="flex flex-1 gap-2">
          <Button
            class="rounded-full"
            size="icon"
            variant="ghost"
          >
            <IconPlayerTrackNextFilled class="size-5" />
          </Button>
          <Button
            class="rounded-full"
            size="icon"
            variant="ghost"
          >
            <IconRepeat class="size-4.5" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import PlayButton from "./PlayButton.vue";
import IconArrowsShuffle2 from "~icons/tabler/arrows-shuffle-2";
import IconPlayerTrackPrevFilled from "~icons/tabler/player-track-prev-filled";
import IconPlayerTrackNextFilled from "~icons/tabler/player-track-next-filled";
import IconRepeat from "~icons/tabler/repeat";

</script>
