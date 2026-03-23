<template>
  <div>
    <Button
      v-if="isSupported"
      class="rounded-full"
      size="icon-lg"
      variant="secondary"
      @click="toggle"
    >
      <component
        :is="ScreenIcon"
        class="size-6"
      />
    </Button>

    <div
      ref="overlayRef"
    >
      <FullscreenPlayer
        v-if="isFullscreen"
        @close="exit"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { Button } from "@/components/ui/button";
import { useFullscreen } from "@vueuse/core";
import IconArrowsMinimize from "~icons/tabler/arrows-minimize";
import IconArrowsDiagonal2 from "~icons/tabler/arrows-diagonal-2";
import FullscreenPlayer from "@/modules/player/components/FullscreenPlayer.vue";

const targetRef = useTemplateRef("overlayRef");
const { isFullscreen, toggle, isSupported, exit } = useFullscreen(targetRef);

const ScreenIcon = computed(() => {
  return isFullscreen.value ? IconArrowsMinimize : IconArrowsDiagonal2;
});

</script>

<style scoped>
:fullscreen {
  z-index: var(--z-fullscreen);
  background-color: var(--background);
  overflow: hidden;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
