<template>
  <svg
    class="theme-preview"
    viewBox="0 0 224 140"
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      <linearGradient
        v-for="(cover, i) in COVERS"
        :id="`${uid}-cover-${i}`"
        :key="i"
        x1="0"
        y1="0"
        x2="0"
        y2="1"
      >
        <stop
          offset="0"
          :stop-color="cover.top"
        />
        <stop
          offset="1"
          :stop-color="cover.bottom"
        />
      </linearGradient>
      <clipPath :id="`${uid}-split-light`">
        <path d="M0 0H224V2L3.2 140H0Z" />
      </clipPath>
      <clipPath :id="`${uid}-split-dark`">
        <path d="M224 0V140H0Z" />
      </clipPath>
    </defs>

    <g
      v-for="layer in layers"
      :key="layer.theme"
      :class="[layer.theme, contrast && 'contrast']"
      :clip-path="layer.clip ? `url(#${uid}-split-${layer.clip})` : undefined"
    >
      <rect
        width="224"
        height="140"
        class="tp-page"
      />
      <rect
        width="56"
        height="120"
        class="tp-panel"
      />
      <rect
        x="168"
        width="56"
        height="120"
        class="tp-panel"
      />
      <rect
        y="120"
        width="224"
        height="20"
        class="tp-panel"
      />
      <rect
        y="120"
        width="224"
        height="1"
        class="tp-edge"
      />

      <template
        v-for="(row, i) in LIBRARY"
        :key="i"
      >
        <rect
          x="8"
          :y="row.y"
          width="12"
          height="12"
          rx="3"
          :fill="`url(#${uid}-cover-${row.cover})`"
        />
        <rect
          x="25"
          :y="row.y + 4"
          :width="row.w"
          height="4"
          rx="2"
          class="tp-line"
        />
      </template>

      <rect
        x="68"
        y="12"
        width="36"
        height="36"
        rx="4"
        :fill="`url(#${uid}-cover-1)`"
      />
      <rect
        x="112"
        y="22"
        width="44"
        height="6"
        rx="3"
        class="tp-title"
      />
      <rect
        x="112"
        y="33"
        width="26"
        height="4"
        rx="2"
        class="tp-line"
      />
      <circle
        cx="75"
        cy="65"
        r="7"
        class="tp-accent"
      />
      <rect
        x="68"
        y="82"
        width="72"
        height="4"
        rx="2"
        class="tp-line"
      />
      <rect
        x="68"
        y="93"
        width="60"
        height="4"
        rx="2"
        class="tp-line"
      />
      <rect
        x="68"
        y="104"
        width="66"
        height="4"
        rx="2"
        class="tp-line"
      />

      <rect
        x="176"
        y="12"
        width="40"
        height="40"
        rx="4"
        class="tp-cover"
      />
      <rect
        x="176"
        y="60"
        width="30"
        height="5"
        rx="2.5"
        class="tp-title"
      />
      <rect
        x="176"
        y="69"
        width="20"
        height="4"
        rx="2"
        class="tp-line"
      />

      <rect
        x="8"
        y="125"
        width="10"
        height="10"
        rx="2"
        class="tp-cover"
      />
      <rect
        x="23"
        y="128"
        width="22"
        height="4"
        rx="2"
        class="tp-line"
      />
      <circle
        cx="111"
        cy="130"
        r="6"
        class="tp-accent"
      />
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed, useId } from "vue";

const props = withDefaults(defineProps<{
  theme: string;
  contrast?: boolean;
}>(), { contrast: false });

const uid = useId();

// The light half stops short of the right and bottom edges: painted under the
// dark one there, it bled through the anti-aliased edge as a light line.
const layers = computed(() =>
  props.theme === "system"
    ? [{ theme: "light", clip: "light" }, { theme: "dark", clip: "dark" }]
    : [{ theme: props.theme, clip: null }],
);

const COVERS = [
  { top: "#5CAFFA", bottom: "#408ACF" },
  { top: "#FEBB5B", bottom: "#F68136" },
  { top: "#9AD164", bottom: "#46BA43" },
  { top: "#FF8AAC", bottom: "#D95574" },
] as const;

const LIBRARY = [
  { y: 12, w: 22, cover: 0 },
  { y: 30, w: 16, cover: 1 },
  { y: 48, w: 20, cover: 2 },
  { y: 66, w: 14, cover: 3 },
] as const;
</script>

<style scoped>
.theme-preview {
  display: block;
  width: 100%;
  height: auto;
  /* Taken here, outside the theme layers: the user's accent lives on <html>,
     and a theme class inside would reset --primary to that theme's default. */
  --tp-accent: var(--primary);
}

.tp-page { fill: var(--card); }
.tp-panel { fill: var(--canvas); }
.tp-edge { fill: var(--border); }
.tp-cover { fill: color-mix(in oklch, var(--foreground) 8%, var(--canvas)); }
.tp-line { fill: color-mix(in oklch, var(--foreground) 16%, var(--card)); }
.tp-title { fill: color-mix(in oklch, var(--foreground) 26%, var(--card)); }
.tp-accent { fill: var(--tp-accent); }
</style>
