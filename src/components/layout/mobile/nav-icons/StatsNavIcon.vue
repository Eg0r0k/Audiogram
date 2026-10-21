<template>
  <NavIcon :plays="props.plays">
    <defs>
      <clipPath :id="barClipId">
        <rect
          x="-2"
          y="-8"
          width="28"
          height="27"
        />
      </clipPath>
    </defs>
    <path d="M3 19a1 1 0 0 0 1 1h4a1 1 0 0 0 1 -1" />
    <path d="M9 19a1 1 0 0 0 1 1h4a1 1 0 0 0 1 -1" />
    <path d="M15 19a1 1 0 0 0 1 1h4a1 1 0 0 0 1 -1" />
    <g :clip-path="`url(#${barClipId})`">
      <path
        class="bar bar-short"
        d="M3 23v-10a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10"
      />
      <path
        class="bar bar-tall"
        d="M9 23v-18a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v18"
      />
      <path
        class="bar bar-middle"
        d="M15 23v-14a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14"
      />
    </g>
    <path d="M4 20h14" />
  </NavIcon>
</template>

<script setup lang="ts">
import { useId } from "vue";
import NavIcon, { type NavIconProps } from "./NavIcon.vue";

const props = defineProps<NavIconProps>();

const barClipId = useId();
</script>

<style scoped>
/* scaleY would squash the stroke, so each bar is a fixed bottom and a sliding
   top clipped at y = 19, where the bottom begins. */
.bar-short {
  --bar-drop: 4.5px;
}

.bar-tall {
  --bar-drop: 12.5px;
  --bar-delay: 70ms;
}

.bar-middle {
  --bar-drop: 8.5px;
  --bar-delay: 140ms;
}

[data-playing] .bar {
  animation: bar-rise 660ms var(--bar-delay, 0ms) both;
}

@keyframes bar-rise {
  0% {
    transform: translateY(0);
    animation-timing-function: cubic-bezier(0.5, 0, 0.75, 0);
  }
  27% {
    transform: translateY(var(--bar-drop));
    animation-timing-function: linear(0,0.0319,0.1116,0.2188,0.3384,0.4591,0.5733,0.6764,0.7657,0.8403,0.9004,0.9472,0.9821,1.0068,1.0231,1.0328,1.0375,1.0383,1.0366,1.0333,1.029,1.0244,1.0198,1.0155,1.0116,1.0083,1.0056,1.0034,1.0017,1.0005,0.9996,0.999,1);
  }
  100% {
    transform: translateY(0);
  }
}
</style>
