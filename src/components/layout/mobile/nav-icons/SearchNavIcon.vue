<template>
  <NavIcon :plays="props.plays">
    <ellipse
      class="lens"
      cx="10"
      cy="10"
      rx="7"
      ry="7"
      transform="rotate(45 10 10)"
    />
    <path d="M21 21l-6 -6" />
  </NavIcon>
</template>

<script setup lang="ts">
import NavIcon, { type NavIconProps } from "./NavIcon.vue";

const props = defineProps<NavIconProps>();
</script>

<style scoped>
/* rotate3d would thin the stroke mid-turn, so the lens is redrawn instead:
   ry = 7 * |cos t| keeps the stroke at 2. ry = 0 does not render, hence the floor. */
@property --lens-turn {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}

.lens {
  ry: max(0.01px, calc(7px * cos(var(--lens-turn))), calc(-7px * cos(var(--lens-turn))));
}

[data-playing] .lens {
  animation: lens-turn 1124ms
    linear(0,0.0065,0.0246,0.0522,0.0873,0.1283,0.1737,0.2223,0.2729,0.3245,0.3763,0.4277,0.478,0.5268,0.5737,0.6184,0.6607,0.7005,0.7376,0.7721,0.8039,0.833,0.8595,0.8835,0.9051,0.9244,0.9416,0.9567,0.9699,0.9813,0.9912,0.9995,1.0066,1.0123,1.017,1.0208,1.0236,1.0257,1.0271,1.028,1.0284,1.0283,1.0279,1.0272,1.0263,1.0251,1.0239,1.0225,1.0211,1.0197,1.0182,1.0167,1.0153,1.0139,1.0125,1.0113,1.01,1.0089,1.0078,1.0068,1)
    both;
}

@keyframes lens-turn {
  from {
    --lens-turn: 0deg;
  }
  to {
    --lens-turn: 360deg;
  }
}
</style>
