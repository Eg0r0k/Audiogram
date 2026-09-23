<template>
  <div
    ref="containerRef"
    class="marquee-wrapper"
    :class="{ vertical, horizontal: !vertical }"
    :style="maskStyle"
    @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeave"
  >
    <div
      ref="motionRef"
      class="marquee-content"
    >
      <div
        ref="trackRef"
        class="marquee-track"
      >
        <div
          ref="itemRef"
          class="marquee-item"
        >
          <slot />
        </div>
      </div>

      <div
        v-if="isOverflowing"
        class="marquee-track"
        aria-hidden="true"
      >
        <div class="marquee-item">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, useTemplateRef, watch } from "vue";
import { useOwnerResizeObserver } from "@/composables/useOwnerResizeObserver";
import { MARQUEE_PAUSE_MS, MARQUEE_SPEED, marqueeMotion } from "./marqueeMotion";

interface Props {
  vertical?: boolean;
  direction?: PlaybackDirection;
  /** CSS px per second; the default suits every call site but rare ones. */
  speed?: number;
  /** Seconds before the first loop. */
  delay?: number;
  /** Loop count; 0 loops forever. */
  loop?: number;
  gradient?: boolean;
  gradientLength?: string;
  pauseOnHover?: boolean;
  pause?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  vertical: false,
  direction: "normal",
  speed: MARQUEE_SPEED,
  delay: 0,
  loop: 0,
  gradient: false,
  gradientLength: "200px",
  pauseOnHover: false,
  pause: false,
});

const containerRef = useTemplateRef<HTMLElement>("containerRef");
const motionRef = useTemplateRef<HTMLElement>("motionRef");
const trackRef = useTemplateRef<HTMLElement>("trackRef");
const itemRef = useTemplateRef<HTMLElement>("itemRef");

const isOverflowing = ref(false);
const isHovering = ref(false);

let animation: Animation | null = null;
let travel = 0;

const maskStyle = computed(() => {
  if (!props.gradient || !isOverflowing.value) return { maskImage: "none" };
  const len = props.gradientLength;
  const side = props.vertical ? "to bottom" : "to right";
  const mask = `linear-gradient(${side}, transparent 0%, black ${len}, black calc(100% - ${len}), transparent 100%)`;
  return { maskImage: mask, WebkitMaskImage: mask };
});

const syncPlayState = () => {
  if (!animation) return;
  if (props.pause || (props.pauseOnHover && isHovering.value)) animation.pause();
  else animation.play();
};

const stopAnimation = () => {
  animation?.cancel();
  animation = null;
  travel = 0;
};

// One animation moves both copies: after a loop the copy stands where the
// original started, so the jump back is invisible.
const startAnimation = (distance: number) => {
  const el = motionRef.value;
  if (!el) return;
  animation?.cancel();
  const { durationMs, holdOffset } = marqueeMotion(distance, props.speed, MARQUEE_PAUSE_MS);
  const axis = props.vertical ? "translateY" : "translateX";
  animation = el.animate([
    { transform: `${axis}(0)`, offset: 0 },
    { transform: `${axis}(0)`, offset: holdOffset },
    { transform: `${axis}(-${distance}px)`, offset: 1 },
  ], {
    duration: durationMs,
    delay: props.delay * 1000,
    iterations: props.loop === 0 ? Infinity : props.loop,
    direction: props.direction,
    easing: "linear",
  });
  travel = distance;
  syncPlayState();
};

// The item is the slot content alone; the track adds the gap between copies,
// which must not count as overflow.
const measure = () => {
  const container = containerRef.value;
  const item = itemRef.value;
  const track = trackRef.value;
  if (!container || !item || !track) return;

  const available = props.vertical ? container.clientHeight : container.clientWidth;
  if (available === 0) return;
  const needed = props.vertical ? item.offsetHeight : item.offsetWidth;

  isOverflowing.value = needed > available + 1;
  if (!isOverflowing.value) {
    stopAnimation();
    return;
  }

  const distance = props.vertical ? track.offsetHeight : track.offsetWidth;
  if (Math.abs(distance - travel) > 1) startAnimation(distance);
};

useOwnerResizeObserver(containerRef, measure);
useOwnerResizeObserver(itemRef, measure);

const onPointerEnter = () => {
  if (props.pauseOnHover) isHovering.value = true;
};

const onPointerLeave = () => {
  if (props.pauseOnHover) isHovering.value = false;
};

watch([() => props.pause, isHovering], syncPlayState);

watch(
  () => [props.speed, props.vertical, props.direction, props.loop, props.delay],
  () => {
    if (travel > 0) startAnimation(travel);
  },
);

onUnmounted(stopAnimation);
</script>

<style scoped>
.marquee-wrapper {
  display: flex;
  position: relative;
  overflow: hidden;
}

.marquee-wrapper.horizontal {
  flex-direction: row;
  width: 100%;
}

.marquee-wrapper.vertical {
  flex-direction: column;
  height: 100%;
}

.marquee-content {
  display: flex;
  width: 100%;
}

.marquee-wrapper.horizontal .marquee-content {
  flex-direction: row;
}

.marquee-wrapper.vertical .marquee-content {
  flex-direction: column;
}

.marquee-track {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.marquee-item {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.marquee-wrapper.horizontal .marquee-item {
  flex-direction: row;
}

.marquee-wrapper.vertical .marquee-item {
  flex-direction: column;
}

.marquee-wrapper.horizontal .marquee-track {
  flex-direction: row;
  min-width: 100%;
  padding-right: 3rem;
}

.marquee-wrapper.vertical .marquee-track {
  flex-direction: column;
  min-height: 100%;
  padding-bottom: 3rem;
}
</style>
