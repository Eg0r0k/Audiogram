<template>
  <div class="pointer-events-none fixed inset-0 top-(--toolbar-height) z-40">
    <Transition name="right-panel-backdrop">
      <button
        v-if="rightPanel.isOpen"
        class="pointer-events-auto absolute inset-0 bg-black/45"
        aria-label="Close right panel"
        @click="rightPanel.close()"
      />
    </Transition>

    <Transition name="slide-panel">
      <div
        v-if="rightPanel.isOpen"
        class="pointer-events-auto absolute inset-0 overflow-hidden bg-card shadow-2xl"
        :style="{ paddingTop: top, paddingBottom: bottom }"
      >
        <RightPanelHost />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { useScreenSafeArea } from "@vueuse/core";
import RightPanelHost from "@/modules/right-panel/components/RightPanelHost.vue";
import { useRightPanelStore } from "@/modules/right-panel/store/right-panel.store";

const rightPanel = useRightPanelStore();
const { top, bottom } = useScreenSafeArea();
</script>

<style scoped>
.slide-panel-enter-active,
.slide-panel-leave-active {
  transition: transform 0.25s ease-out;
}

.slide-panel-enter-from,
.slide-panel-leave-to {
  transform: translateX(100%);
}

.right-panel-backdrop-enter-active,
.right-panel-backdrop-leave-active {
  transition: opacity 0.2s ease-out;
}

.right-panel-backdrop-enter-from,
.right-panel-backdrop-leave-to {
  opacity: 0;
}
</style>
