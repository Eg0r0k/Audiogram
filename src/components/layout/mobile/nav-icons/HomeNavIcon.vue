<template>
  <NavIcon :plays="props.plays">
    <g class="house">
      <path
        class="roof"
        d="M5 12l-2 0l9 -9l9 9l-2 0"
      />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" />
      <path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" />
    </g>
  </NavIcon>
</template>

<script setup lang="ts">
import NavIcon, { type NavIconProps } from "./NavIcon.vue";

const props = defineProps<NavIconProps>();
</script>

<style scoped>
/* The gap under the roof at the top of its hop is deliberate: with round caps
   on both parts it reads as a lid, not a broken outline. */
.house {
  transform-origin: 12px 21px;
}

[data-playing] .house {
  animation: house-impact 800ms both;
}

[data-playing] .roof {
  animation: roof-hop 800ms both;
}

@keyframes roof-hop {
  0% {
    transform: translateY(0);
    animation-timing-function: cubic-bezier(0.3, 0, 0.5, 1);
  }
  10% {
    transform: translateY(0.7px);
    animation-timing-function: cubic-bezier(0.15, 0.7, 0.3, 1);
  }
  32% {
    transform: translateY(-3.4px);
    animation-timing-function: cubic-bezier(0.6, 0, 0.9, 0.5);
  }
  52% {
    transform: translateY(0);
    animation-timing-function: cubic-bezier(0.2, 0.6, 0.35, 1);
  }
  62% {
    transform: translateY(-0.8px);
    animation-timing-function: cubic-bezier(0.6, 0, 0.9, 0.5);
  }
  72%,
  100% {
    transform: translateY(0);
  }
}

@keyframes house-impact {
  0%,
  52% {
    transform: translateY(0);
    animation-timing-function: cubic-bezier(0.2, 0.8, 0.3, 1);
  }
  58% {
    transform: translateY(0.9px);
    animation-timing-function: linear(0,0.0319,0.1116,0.2188,0.3384,0.4591,0.5733,0.6764,0.7657,0.8403,0.9004,0.9472,0.9821,1.0068,1.0231,1.0328,1.0375,1.0383,1.0366,1.0333,1.029,1.0244,1.0198,1.0155,1.0116,1.0083,1.0056,1.0034,1.0017,1.0005,0.9996,0.999,1);
  }
  100% {
    transform: translateY(0);
  }
}
</style>
