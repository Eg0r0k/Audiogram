<template>
  <div class="min-w-[180px] w-[30%] pl-1">
    <div class="flex justify-start items-center relative select-none">
      <div
        class=" relative shrink-0  size-14 rounded overflow-hidden"
      >
        <NuxtImage
          placeholder
          class="w-full h-full object-cover object-center absolute left-0 top-0"
          draggable="false"
          :src="currentTrack.cover"
          loading="eager"
          alt=""
        />
      </div>

      <div class="data-track min-w-0 max-w-fit overflow-hidden mx-2">
        <MarqueeBlock
          :duration="10"
          animate-on-overflow-only
          pause-on-hover
          gradient
          gradient-color="var(--card)"
          gradient-length="20px"
        >
          <span class="text-sm font-medium">{{ currentTrack.title }}</span>
        </MarqueeBlock>
        <MarqueeBlock
          :duration="6"
          animate-on-overflow-only
          pause-on-hover
          gradient
          gradient-color="var(--card)"
          gradient-length="20px"
        >
          <span class="text-muted-foreground text-xs truncate capitalize">
            {{ currentTrack.artist }}
          </span>
        </MarqueeBlock>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        class="rounded-full"
        @click.stop="toggle"
      >
        <Like
          ref="likeRef"
          class="text-xl"
          :is-liked="liked"
        />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, useTemplateRef } from "vue";
import { Button } from "@/components/ui/button";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import MarqueeBlock from "@/components/ui/marquee/MarqueeBlock.vue";
import Like from "./actions/Like.vue";

const likeRef = useTemplateRef("likeRef");
const liked = ref(false);
const toggle = () => {
  if (!liked.value) {
    likeRef.value?.playAnimation();
  }
  liked.value = !liked.value;
};

const tracks = [
  {
    title: "Название трека",
    artist: "ЛСП",
    cover: "https://i.scdn.co/image/ab67616d000048514feb42ff53928276cf9d9f5a",
  },
  {
    title: "Короткий",
    artist: "Oxxxymiron",
    cover: "https://i.scdn.co/image/ab67616d00004851a1c37f3fd969287c03482c3b",
  },
  {
    title: "Ещё один трек с супер длинным названием для теста marquee",
    artist: "Скриптонит",
    cover: "https://i.scdn.co/image/ab67616d00004851e419ccba0baa8bd3f3d7abf4",
  },
];

const currentIndex = ref(0);
const currentTrack = computed(() => tracks[currentIndex.value]);

</script>

<style scoped>
.data-track {
  display: grid;
  gap: 2px;
  flex: 1;
}
</style>
