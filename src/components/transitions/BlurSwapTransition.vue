<template>
  <span
    class="relative inline-flex shrink-0 items-center"
    :class="props.class"
  >
    <AnimatePresence
      mode="popLayout"
      :initial="false"
    >
      <motion.span
        :key="state"
        :data-swap-key="state"
        class="inline-flex items-center gap-2 whitespace-nowrap"
        :initial="swap.initial"
        :animate="swap.animate"
        :exit="swap.exit"
        :transition="transition"
      >
        <slot />
      </motion.span>
    </AnimatePresence>
  </span>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { AnimatePresence, motion } from "motion-v";
import { computed } from "vue";

/**
 * Crossfades inline content whenever `state` changes (a label turning into
 * a spinner, an icon into another icon). The outgoing child is popped out
 * of flow, so the wrapper only ever takes the incoming child's size; the
 * element carries `data-swap-key` for parents that need to measure it.
 *
 * A touch of blur bridges the two states so they read as one object
 * changing rather than two swapped; heavier blur gets expensive on Safari.
 * Reduced motion is handled globally by MotionGlobalConfig.
 */
const props = withDefaults(defineProps<{
  /** Key of the current content; a change starts the swap. */
  state: string;
  blur?: boolean;
  /** Duration multiplier, >1 slows the swap down (debugging aid). */
  timeScale?: number;
  class?: HTMLAttributes["class"];
}>(), { blur: true, timeScale: 1, class: undefined });

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

const swap = computed(() => {
  const hidden = props.blur ? "blur(2px)" : "blur(0px)";
  return {
    initial: { opacity: 0, filter: hidden, scale: 0.96 },
    animate: { opacity: 1, filter: "blur(0px)", scale: 1 },
    exit: { opacity: 0, filter: hidden, scale: 0.96 },
  };
});

const transition = computed(() => ({ duration: 0.18 * props.timeScale, ease: EASE_OUT }));
</script>
