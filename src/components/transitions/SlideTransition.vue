<template>
  <div class="slide-transition-container">
    <Transition :name="transitionName">
      <slot />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  depth?: number;
}>();

const transitionName = ref("");

watch(
  () => props.depth,
  (newDepth, oldDepth) => {
    if (newDepth === undefined || oldDepth === undefined) {
      transitionName.value = "";
      return;
    }

    if (newDepth === oldDepth) {
      transitionName.value = "";
      return;
    }

    if (newDepth > oldDepth) {
      transitionName.value = "slide-left";
    }
    else {
      transitionName.value = "slide-right";
    }
  },
);
</script>

<style>
:root {
  --transition-standard: cubic-bezier(.4, 0, .2, 1);
  --transition-duration: 0.3s;
  --parallax-offset: -20%;
  --overlay-brightness: 0.7;
}

.slide-transition-container {
  display: grid;
  grid-template-columns: 100%;
  grid-template-rows: 100%;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #000;
  position: relative;
}

.slide-transition-container > * {
  grid-column: 1;
  grid-row: 1;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  backface-visibility: hidden;
  transform: translate3d(0,0,0);
  will-change: transform;
  background-color: var(--background, #fff);
}

.slide-transition-container > * {
   box-shadow: -2px 0 10px rgba(0,0,0,0.1);
}

.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform var(--transition-duration) var(--transition-standard),
              filter var(--transition-duration) var(--transition-standard);
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
.slide-left-enter-from {
  transform: translate3d(100%, 0, 0);
  z-index: 100;
}
.slide-left-enter-to {
  transform: translate3d(0, 0, 0);
  z-index: 100;
}

.slide-left-leave-from {
  transform: translate3d(0, 0, 0);
  filter: brightness(1);
  z-index: 1;
}
.slide-left-leave-to {
  transform: translate3d(var(--parallax-offset), 0, 0);
  filter: brightness(var(--overlay-brightness));
  z-index: 1;
}
.slide-right-enter-from {
  transform: translate3d(var(--parallax-offset), 0, 0);
  filter: brightness(var(--overlay-brightness));
  z-index: 1;
}
.slide-right-enter-to {
  transform: translate3d(0, 0, 0);
  filter: brightness(1);
  z-index: 1;
}

.slide-right-leave-from {
  transform: translate3d(0, 0, 0);
  z-index: 100;
}
.slide-right-leave-to {
  transform: translate3d(100%, 0, 0);
  z-index: 100;
}

</style>
