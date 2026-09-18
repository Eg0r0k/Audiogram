<template>
  <div
    class="pointer-events-none absolute inset-y-0 left-0 w-full origin-left transition-colors duration-300"
    :style="{ background: fill, transform: `scaleX(${progress / 100})` }"
  />
</template>

<script setup lang="ts">
import { inject } from "vue";
import { miniPlayerProgressKey } from "./mini-player-context";

defineProps<{ fill: string }>();

const progress = inject(miniPlayerProgressKey);
if (!progress) throw new Error("MiniPlayerProgress must be rendered inside MiniPlayer");
</script>
