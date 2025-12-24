<template>
  <div class="flex min-w-[180px] w-[30%] justify-end pr-2">
    <div class="flex w-full gap-0.5 justify-end items-center grow">
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
      <Button
        size="icon-sm"
        variant="ghost"
      >
        <IconDots
          class="size-4.5"
        />
      </Button>

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

import IconPlaylist from "~icons/tabler/playlist";
import IconDevices2 from "~icons/tabler/devices-2";
import IconDeviceSpeaker from "~icons/tabler/device-speaker-filled";
import IconDots from "~icons/tabler/dots";

import PIPTrigger from "@/components/pip/PIPTrigger.vue";
import FullscreenTrigger from "@/components/layout/fullscreen/FullscreenTrigger.vue";
import VolumeButton from "./actions/VolumeButton.vue";
</script>
