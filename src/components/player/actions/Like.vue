<template>
  <div
    class="relative inline-flex items-center justify-center"
  >
    <Motion
      v-if="showEffects"
      tag="span"
      :initial="{ scale: 0.3, opacity: 1 }"
      :animate="{ scale: 2.5, opacity: 0 }"
      :transition="{ duration: 0.4, ease: 'easeOut' }"
      class="absolute inset-0 rounded-full border border-red-400"
    />

    <Motion
      v-for="(particle, i) in particles"
      v-show="showEffects"
      :key="`particle-${animationKey}-${i}`"
      tag="span"
      :initial="{ x: 0, y: 0, scale: 1, opacity: 1 }"
      :animate="{ x: particle.x, y: particle.y, scale: 0, opacity: 0 }"
      :transition="{ duration: 0.5, ease: 'easeOut', delay: 0.05 }"
      class="absolute size-1.5 rounded-full"
      :class="particle.color"
    />

    <Motion
      :key="`heart-${animationKey}`"
      tag="span"
      :initial="{ scale: 1 }"
      :animate="{ scale: isAnimating ? [1, 0.6, 1.4, 0.9, 1.1, 1] : 1 }"
      :transition="{ duration: 0.5, ease: 'easeOut' }"
      class="relative z-10 flex items-center justify-center"
    >
      <Icon
        :icon="isLiked ? 'tabler:heart-filled' : 'tabler:heart'"
        class="transition-colors duration-150"
        :class="isLiked ? 'text-red-500' : 'text-current'"
        :style="{ fontSize: 'inherit' }"
      />
    </Motion>

    <Motion
      v-for="(heart, i) in miniHearts"
      v-show="showEffects"
      :key="`heart-mini-${animationKey}-${i}`"
      tag="span"
      :initial="{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }"
      :animate="{
        x: heart.x,
        y: heart.y,
        scale: [0, 1, 0.8, 0],
        opacity: [1, 1, 0.8, 0],
        rotate: heart.rotate,
      }"
      :transition="{ duration: 0.6, ease: 'easeOut', delay: heart.delay }"
      class="absolute text-red-400"
    >
      <Icon
        icon="tabler:heart-filled"
        class="size-2"
      />
    </Motion>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { Motion } from "motion-v";
import { ref, watch, nextTick } from "vue";

const props = defineProps<{
  isLiked: boolean;
}>();

const showEffects = ref(false);
const isAnimating = ref(false);
const animationKey = ref(0);

const particles = [
  { x: 0, y: -22, color: "bg-red-400" },
  { x: 19, y: -11, color: "bg-pink-400" },
  { x: 19, y: 11, color: "bg-red-500" },
  { x: 0, y: 22, color: "bg-pink-500" },
  { x: -19, y: 11, color: "bg-red-400" },
  { x: -19, y: -11, color: "bg-pink-400" },
];

const miniHearts = [
  { x: -16, y: -20, rotate: -30, delay: 0 },
  { x: 18, y: -18, rotate: 25, delay: 0.05 },
  { x: -20, y: 12, rotate: -20, delay: 0.1 },
  { x: 16, y: 16, rotate: 35, delay: 0.08 },
];

const playAnimation = async () => {
  showEffects.value = false;
  isAnimating.value = false;

  animationKey.value++;
  await nextTick();

  showEffects.value = true;
  isAnimating.value = true;

  setTimeout(() => {
    showEffects.value = false;
    isAnimating.value = false;
  }, 700);
};

defineExpose({
  playAnimation,
});
</script>
