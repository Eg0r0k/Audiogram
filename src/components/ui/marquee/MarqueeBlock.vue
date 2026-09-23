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

    <template v-if="gradient && gradientColor">
      <div
        v-show="isOverflowing"
        ref="startFadeRef"
        class="marquee-fade start"
        :style="fadeStyle('start')"
        aria-hidden="true"
      />
      <div
        v-show="isOverflowing"
        class="marquee-fade end"
        :style="fadeStyle('end')"
        aria-hidden="true"
      />
    </template>
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
  /**
   * Solid colour behind the line: the edges then fade under static overlays
   * of it. Without it they fade through a mask, which makes the compositor
   * redraw the whole masked line on every frame of the scroll.
   */
  gradientColor?: string;
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
  gradientColor: undefined,
  gradientLength: "200px",
  pauseOnHover: false,
  pause: false,
});

const containerRef = useTemplateRef<HTMLElement>("containerRef");
const motionRef = useTemplateRef<HTMLElement>("motionRef");
const trackRef = useTemplateRef<HTMLElement>("trackRef");
const itemRef = useTemplateRef<HTMLElement>("itemRef");
const startFadeRef = useTemplateRef<HTMLElement>("startFadeRef");

const isOverflowing = ref(false);
const isHovering = ref(false);

let animations: Animation[] = [];
let travel = 0;
// Bumped whenever the scroll is stopped or restarted, so a loop that ends
// afterwards does not chain another one.
let generation = 0;

const FADE_DIRECTION = {
  horizontal: { start: "to right", end: "to left" },
  vertical: { start: "to bottom", end: "to top" },
} as const;

const fadeStyle = (edge: "start" | "end") => {
  const towards = FADE_DIRECTION[props.vertical ? "vertical" : "horizontal"][edge];
  return {
    [props.vertical ? "height" : "width"]: props.gradientLength,
    background: `linear-gradient(${towards}, ${props.gradientColor}, transparent)`,
  };
};

const maskStyle = computed(() => {
  if (!props.gradient || !isOverflowing.value || props.gradientColor) return {};
  const len = props.gradientLength;
  const side = props.vertical ? "to bottom" : "to right";
  const mask = `linear-gradient(${side}, transparent 0%, black var(--marquee-fade-start), black calc(100% - ${len}), transparent 100%)`;
  return { maskImage: mask, WebkitMaskImage: mask };
});

const syncPlayState = () => {
  const paused = props.pause || (props.pauseOnHover && isHovering.value);
  for (const animation of animations) {
    if (paused) animation.pause();
    else animation.play();
  }
};

const cancelAnimations = () => {
  for (const animation of animations) animation.cancel();
  animations = [];
};

const stopAnimation = () => {
  generation++;
  cancelAnimations();
  travel = 0;
};

// While the line rests its first letters sit on the start edge, so that fade
// shows only while the text moves: it comes in over the time the text needs
// to cross it and leaves the same way as the next copy arrives. Two short
// animations rather than one per loop: an animation that is waiting or has
// ended costs nothing, while the mask variant animates a custom property on
// the main thread for as long as it is active.
const animateStartFade = (moveStartMs: number, travelMs: number): Animation[] => {
  if (!props.gradient || props.direction !== "normal") return [];
  const target = props.gradientColor ? startFadeRef.value : containerRef.value;
  if (!target) return [];
  const rampMs = Math.min((Number.parseFloat(props.gradientLength) / props.speed) * 1000, travelMs / 2);
  const [hidden, shown] = props.gradientColor
    ? [{ opacity: 0 }, { opacity: 1 }]
    : [{ "--marquee-fade-start": "0px" }, { "--marquee-fade-start": props.gradientLength }];
  return [
    target.animate([hidden, shown], { delay: moveStartMs, duration: rampMs, fill: "both" }),
    target.animate([shown, hidden], { delay: moveStartMs + travelMs - rampMs, duration: rampMs, fill: "forwards" }),
  ];
};

// One animation moves both copies: after a loop the copy stands where the
// original started, so the jump back is invisible. Each loop is its own
// animation, chained on the previous one's end, which falls in the rest.
const runLoop = (distance: number, index: number, run: number) => {
  const el = motionRef.value;
  if (!el) return;
  cancelAnimations();
  const { durationMs, holdOffset } = marqueeMotion(distance, props.speed, MARQUEE_PAUSE_MS);
  const axis = props.vertical ? "translateY" : "translateX";
  // The first loop skips its rest, so the line starts moving at once.
  const skipRest = index === 1 && props.direction === "normal" ? MARQUEE_PAUSE_MS : 0;
  const delay = (index === 1 ? props.delay * 1000 : 0) - skipRest;
  const moving = el.animate([
    { transform: `${axis}(0)`, offset: 0 },
    { transform: `${axis}(0)`, offset: holdOffset },
    { transform: `${axis}(-${distance}px)`, offset: 1 },
  ], { duration: durationMs, delay, direction: props.direction, easing: "linear" });
  animations = [moving, ...animateStartFade(delay + MARQUEE_PAUSE_MS, durationMs - MARQUEE_PAUSE_MS)];
  syncPlayState();

  moving.finished.then(() => {
    if (run !== generation || (props.loop !== 0 && index >= props.loop)) return;
    runLoop(distance, index + 1, run);
  }, () => {});
};

const startAnimation = (distance: number) => {
  generation++;
  travel = distance;
  runLoop(distance, 1, generation);
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
@property --marquee-fade-start {
  syntax: "<length>";
  inherits: false;
  initial-value: 0px;
}

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

.marquee-fade {
  position: absolute;
  z-index: 1;
  pointer-events: none;
}

.marquee-wrapper.horizontal .marquee-fade {
  top: 0;
  bottom: 0;
}

.marquee-wrapper.vertical .marquee-fade {
  left: 0;
  right: 0;
}

.marquee-wrapper.horizontal .marquee-fade.start {
  left: 0;
}

.marquee-wrapper.horizontal .marquee-fade.end {
  right: 0;
}

.marquee-wrapper.vertical .marquee-fade.start {
  top: 0;
}

.marquee-wrapper.vertical .marquee-fade.end {
  bottom: 0;
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
