<template>
  <NavIcon :plays="props.plays">
    <path
      class="gear"
      d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065"
    />
    <path
      class="core"
      d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"
    />
  </NavIcon>
</template>

<script setup lang="ts">
import NavIcon, { type NavIconProps } from "./NavIcon.vue";

const props = defineProps<NavIconProps>();
</script>

<style scoped>
/* 8 teeth: half a turn lands on the same look. */
.gear,
.core {
  transform-origin: 12px 12px;
}

[data-playing] .gear {
  animation: gear-turn 824ms
    linear(0,0.0379,0.1322,0.2579,0.396,0.5327,0.6587,0.7685,0.8594,0.931,0.9846,1.0219,1.0457,1.0586,1.0632,1.0618,1.0564,1.0488,1.0401,1.0314,1.0232,1.016,1.01,1.0052,1.0016,0.999,0.9974,0.9964,0.996,0.996,0.9963,0.9968,1)
    both;
}

[data-playing] .core {
  animation: core-press 600ms both;
}

@keyframes gear-turn {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(180deg);
  }
}

@keyframes core-press {
  0% {
    transform: scale(1);
    animation-timing-function: cubic-bezier(0.3, 0, 0.4, 1);
  }
  25% {
    transform: scale(0.72);
    animation-timing-function: linear(0,0.0319,0.1116,0.2188,0.3384,0.4591,0.5733,0.6764,0.7657,0.8403,0.9004,0.9472,0.9821,1.0068,1.0231,1.0328,1.0375,1.0383,1.0366,1.0333,1.029,1.0244,1.0198,1.0155,1.0116,1.0083,1.0056,1.0034,1.0017,1.0005,0.9996,0.999,1);
  }
  100% {
    transform: scale(1);
  }
}
</style>
