<script setup lang="ts">
import type { ToastStatus } from ".";

const props = defineProps<{ status: ToastStatus }>();
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    :data-status="props.status"
    class="toast-status-icon overflow-visible"
  >
    <template v-if="props.status === 'warning'">
      <path
        class="draw triangle"
        pathLength="1"
        d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0"
      />
      <path
        class="draw bang"
        pathLength="1"
        d="M12 9v4"
      />
      <path
        class="pop"
        d="M12 16h.01"
      />
    </template>
    <template v-else>
      <path
        class="draw ring"
        pathLength="1"
        d="M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0 -18"
      />
      <path
        v-if="props.status === 'success'"
        class="draw tick"
        pathLength="1"
        d="M9 12l2 2l4 -4"
      />
      <template v-else-if="props.status === 'info'">
        <path
          class="drop"
          d="M12 9h.01"
        />
        <path
          class="draw stem"
          pathLength="1"
          d="M11 12h1v4h1"
        />
      </template>
      <template v-else>
        <path
          class="draw cross-start"
          pathLength="1"
          d="M10 10l4 4"
        />
        <path
          class="draw cross-end"
          pathLength="1"
          d="M14 10l-4 4"
        />
      </template>
    </template>
  </svg>
</template>

<style scoped>
/* With the gap twice the dash, an offset past 1 leaves the stroke fully off
   the path, so a round cap does not show as a dot before drawing starts. */
.draw {
  stroke-dasharray: 1 2;
}

.ring {
  animation: draw 560ms cubic-bezier(0.65, 0, 0.35, 1) both;
}

.tick {
  animation: draw 300ms cubic-bezier(0.45, 0, 0.2, 1) 400ms both;
}

.drop {
  animation: drop 831ms
    linear(0,0.0657,0.2257,0.4297,0.6385,0.8247,0.9726,1.0763,1.1372,1.1616,1.1581,1.1363,1.1046,1.0703,1.0383,1.0119,0.9925,0.9803,0.9744,0.9736,0.9763,0.9811,0.9866,0.9921,0.9967,1.0003,1.0027,1.0039,1.0043,1.0041,1.0034,1.0025,1)
    280ms both;
}

.stem {
  animation: draw 320ms cubic-bezier(0.3, 0, 0.2, 1) 420ms both;
}

.cross-start {
  animation: draw 200ms cubic-bezier(0.45, 0, 0.2, 1) 400ms both;
}

.cross-end {
  animation: draw 200ms cubic-bezier(0.45, 0, 0.2, 1) 520ms both;
}

.triangle {
  animation: draw 600ms cubic-bezier(0.65, 0, 0.35, 1) both;
}

.bang {
  animation: draw 200ms cubic-bezier(0.2, 0, 0.2, 1) 380ms both;
}

.pop {
  transform-origin: 12px 16px;
  animation: pop 831ms
    linear(0,0.0657,0.2257,0.4297,0.6385,0.8247,0.9726,1.0763,1.1372,1.1616,1.1581,1.1363,1.1046,1.0703,1.0383,1.0119,0.9925,0.9803,0.9744,0.9736,0.9763,0.9811,0.9866,0.9921,0.9967,1.0003,1.0027,1.0039,1.0043,1.0041,1.0034,1.0025,1)
    540ms both;
}

@keyframes draw {
  from {
    stroke-dashoffset: 1.01;
  }
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes drop {
  from {
    transform: translateY(-4px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes pop {
  from {
    transform: scale(0);
  }
  to {
    transform: scale(1);
  }
}

/* The global reduced-motion rule shortens durations but keeps delays, which
   would hold the later strokes hidden for a moment. */
@media (prefers-reduced-motion: reduce) {
  .toast-status-icon * {
    animation: none !important;
  }
}
</style>
