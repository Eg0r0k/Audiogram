<template>
  <svg
    :viewBox="`0 0 ${qr.size} ${qr.size}`"
    shape-rendering="crispEdges"
    role="img"
    :aria-label="value"
  >
    <path
      :d="qr.path"
      fill="currentColor"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { encode } from "uqr";

const props = defineProps<{ value: string }>();

// One path for the whole grid: a few hundred rects would be a few hundred
// nodes for a 33×33 code.
const qr = computed(() => {
  const encoded = encode(props.value, { border: 1 });
  const cells: string[] = [];
  encoded.data.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) cells.push(`M${x} ${y}h1v1h-1z`);
    });
  });
  return { size: encoded.size, path: cells.join("") };
});
</script>
