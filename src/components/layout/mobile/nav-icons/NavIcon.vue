<template>
  <svg
    :key="props.plays"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    :data-playing="props.plays > 0 || undefined"
    class="overflow-visible"
  >
    <slot />
  </svg>
</template>

<script setup lang="ts">
export interface NavIconProps {
  /** Each increment remounts the svg, which replays its CSS animations; 0 keeps the icon still. */
  plays: number;
}

const props = defineProps<NavIconProps>();
</script>
