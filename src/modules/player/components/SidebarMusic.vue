<template>
  <div class="min-w-[180px] w-[30%] h-14 pl-1">
    <div
      v-if="currentTrack"
      class="flex justify-start items-center relative select-none "
    >
      <div class="relative shrink-0 group size-14 rounded overflow-hidden">
        <NuxtImage
          class="w-full  h-full object-cover object-center absolute left-0 top-0"
          draggable="false"
          :src="currentTrack?.cover"
          fallback-src="/img/fallback.svg"
          :alt="currentTrack?.title ?? ''"
        />

        <FullscreenTrigger class="absolute rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div class="grid gap-1 flex-1  min-w-0 max-w-fit overflow-hidden mx-2">
        <MarqueeBlock
          :duration="10"
          animate-on-overflow-only
          pause-on-hover
          gradient
          gradient-color="var(--card)"
          gradient-length="20px"
        >
          <span class="text-sm font-medium">{{ currentTrack?.title }}</span>
        </MarqueeBlock>
        <MarqueeBlock
          :duration="6"
          animate-on-overflow-only
          pause-on-hover
          gradient
          gradient-color="var(--card)"
          gradient-length="20px"
        >
          <span class="text-muted-foreground text-xs">
            {{ currentTrack?.artist }}
          </span>
        </MarqueeBlock>
      </div>
      <Button
        size="icon-sm"
        class="rounded-full mr-1"
        variant="ghost"
      >
        <IconDots class="size-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        class="rounded-full"
        @click.stop="toggle"
      >
        <IconLike class="size-5" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { Button } from "@/components/ui/button";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import MarqueeBlock from "@/components/ui/marquee/MarqueeBlock.vue";

import IconDots from "~icons/tabler/dots";
import IconLike from "~icons/tabler/heart";

import FullscreenTrigger from "@/components/layout/fullscreen/FullscreenTrigger.vue";
import { usePlayerStore } from "@/modules/player/store/player.store";
const playerStore = usePlayerStore();

const currentTrack = computed(() => playerStore.currentTrack);

const liked = ref(false);
const toggle = () => {
  liked.value = !liked.value;
};

</script>
