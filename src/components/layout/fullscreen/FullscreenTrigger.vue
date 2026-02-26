<template>
  <div>
    <Button
      v-if="isSupported"
      class=" rounded-full"
      size="icon-lg"
      variant="secondary"
      @click="toggle"
    >
      <component
        :is="ScreenIcon"
        class=" size-6"
      />
    </Button>
    <div
      ref="overlayRef"
      class="bg-background"
    >
      <slot />

      <Button
        v-if="isFullscreen"
        class="absolute top-4 right-4 rounded-full"
        size="icon-lg"
        variant="ghost"
        @click="exit"
      >
        <IconClose
          class="size-6"
        />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { Button } from "@/components/ui/button";
import { useFullscreen } from "@vueuse/core";
import IconArrowsMinimize from "~icons/tabler/arrows-minimize";
import IconClose from "~icons/tabler/x";

import IconArrowsDiagonal2 from "~icons/tabler/arrows-diagonal-2";
// TODO: Make 2 components FullscreenButton and Overlay
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
  overflow: auto;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
