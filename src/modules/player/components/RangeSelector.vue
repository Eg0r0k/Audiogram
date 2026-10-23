<!-- eslint-disable vuejs-accessibility/form-control-has-label -->
<template>
  <Tooltip
    :open="isTooltipOpen"
    touch="off"
    :close-on-click="false"
  >
    <TooltipTrigger
      as-child
      :reference="tooltipAnchor"
    >
      <div
        ref="containerRef"
        v-bind="$attrs"
        :class="containerClasses"
      >
        <div class="range-selector__track">
          <div
            v-for="(segment, i) in segments"
            :key="i"
            class="range-selector__segment"
            :class="{ 'range-selector__segment--hover': hoverSegmentIndex === i }"
            :style="segmentStyle(segment)"
          >
            <div
              :ref="el => (hoverFillEls[i] = el as HTMLElement | null)"
              class="range-selector__hover-filled"
            />
            <div
              :ref="el => (fillEls[i] = el as HTMLElement | null)"
              class="range-selector__filled"
            />
          </div>
        </div>

        <div
          v-if="showThumb"
          ref="thumbRef"
          class="range-selector__thumb"
        />

        <input
          ref="seekRef"
          class="range-selector__input"
          type="range"
          :disabled="disabled"
          :step="step"
          :min="min"
          :max="max"
          :aria-label="$t('common.progress')"
          @input="onInput"
          @keydown="onKeyDown"
        >
      </div>
    </TooltipTrigger>
    <TooltipContent
      side="top"
      :side-offset="8"
      update-position-strategy="always"
      class="flex flex-col items-center px-2 py-1 tabular-nums data-[state=instant-open]:animate-[kappa-overlay-in_var(--transition-duration-short-4)_var(--ease-emphasized-decelerate)]"
    >
      <span
        v-if="tooltipChapter"
        class="max-w-55 truncate font-medium"
      >{{ tooltipChapter }}</span>
      <span>{{ tooltipTime }}</span>
    </TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from "vue";
import { useElementBounding, useEventListener } from "@vueuse/core";
import { clamp } from "@/lib/math";
import { isRTL } from "@/lib/environment/lang";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface GrabEvent {
  x: number;
  y: number;
  originalEvent: MouseEvent | TouchEvent;
}

export interface RangeSelectorChapter {
  time: number;
  title?: string;
}

interface Segment {
  start: number; // percent, 0-100
  end: number; // percent, 0-100
  title?: string;
}

export interface RangeSelectorProps {
  step: number;
  keyboardStep?: number;
  min?: number;
  max?: number;
  showThumb?: boolean;
  withTransition?: boolean;
  useTransform?: boolean;
  vertical?: boolean;
  offsetAxisValue?: number;
  modelValue?: number;
  disableTransition?: boolean;
  disabled?: boolean;
  chapters?: RangeSelectorChapter[];
  duration?: number;
  showTooltip?: boolean;
}
// The root is the tooltip, which renders no element of its own: a host's
// class or style goes on the bar.
defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<RangeSelectorProps>(), {
  min: 0,
  max: 100,
  withTransition: false,
  useTransform: true,
  vertical: false,
  offsetAxisValue: 0,
  modelValue: 0,
  showThumb: false,
  disableTransition: false,
  disabled: false,
  chapters: () => [],
  duration: undefined,
  showTooltip: true,
});

const emit = defineEmits<{
  "update:modelValue": [value: number];
  "mousedown": [event: GrabEvent];
  "mouseup": [event: GrabEvent];
  "scrub": [value: number];
}>();

const containerRef = useTemplateRef<HTMLDivElement>("containerRef");
const seekRef = useTemplateRef<HTMLInputElement>("seekRef");
const thumbRef = useTemplateRef<HTMLDivElement>("thumbRef");
// One fill (and one hover fill) per segment, the way YouTube draws chapters:
// the gaps between segments are empty space, so the played colour can never
// paint over them. Filled by function refs, written to directly (no render).
const fillEls: (HTMLElement | null)[] = [];
const hoverFillEls: (HTMLElement | null)[] = [];
// Last value written per segment: a progress tick touches only the segment
// it is in, the finished and the untouched ones keep their style as is.
let lastFill: number[] = [];
let lastHoverFill: number[] = [];

const mousedown = ref(false);
// Not bound in the template: the value lands on the <input> and the bar by
// direct DOM writes (setProgress), so a progress tick re-renders nothing.
// Seeded from the prop on mount, when the <input> exists to take it.
const internalValue = ref(0);

const isHovering = ref(false);
const hoverPercent = ref(0);

// Next-frame: the sync default re-measures inside the mutation observer
// microtask of every class change, which on a track change means a forced
// layout in the middle of the frame that re-keys the cover strip (~10 ms on
// a phone). At the next frame's start the layout is already clean.
// No window scroll listener: it captures the scroll of every list in the
// app, and neither host of the bar sits inside a scroller.
const { width, height, left, bottom } = useElementBounding(containerRef, { updateTiming: "next-frame", windowScroll: false });

const keyStep = computed(() => props.keyboardStep ?? (props.max - props.min) / 20);

const decimals = computed(() => {
  const stepStr = String(props.step);
  const index = stepStr.indexOf(".");
  return index === -1 ? 0 : stepStr.length - index - 1;
});

const containerClasses = computed(() => [
  "range-selector",
  {
    "range-selector--transform": props.useTransform,
    "range-selector--transition": props.withTransition && !props.useTransform && !props.disableTransition,
    "range-selector--active": mousedown.value,
    "range-selector--hovering": isHovering.value,
    "range-selector--hover-fill": !!props.duration && (isHovering.value || mousedown.value),
    "range-selector--no-transition": props.disableTransition,
    "range-selector--disabled": props.disabled,
  },
]);

const segments = computed<Segment[]>(() => {
  if (!props.chapters.length || !props.duration) {
    return [{ start: 0, end: 100 }];
  }

  const sorted = [...props.chapters].sort((a, b) => a.time - b.time);
  const dur = props.duration;
  const result: Segment[] = [];

  if (sorted[0].time > 0) {
    result.push({ start: 0, end: clamp((sorted[0].time / dur) * 100, 0, 100) });
  }

  for (let i = 0; i < sorted.length; i++) {
    const nextTime = sorted[i + 1]?.time ?? dur;
    result.push({
      start: clamp((sorted[i].time / dur) * 100, 0, 100),
      end: clamp((nextTime / dur) * 100, 0, 100),
      title: sorted[i].title,
    });
  }

  return result;
});

const hasChapters = computed(() => segments.value.length > 1);

// Half of the gap between two chapters, in px: each segment is inset by it
// on both sides. No chapters, no gap.
const SEGMENT_INSET = 2;
const segmentInset = computed(() => (hasChapters.value ? SEGMENT_INSET : 0));

function segmentStyle(segment: Segment): Record<string, string> {
  const inset = segmentInset.value;
  return {
    left: `calc(${segment.start}% + ${inset}px)`,
    width: `calc(${Math.max(segment.end - segment.start, 0)}% - ${inset * 2}px)`,
  };
}

/** Index of the segment a percent falls in; the last one takes 100. */
function segmentIndexAt(percent: number): number {
  const list = segments.value;
  for (let i = 0; i < list.length - 1; i++) {
    if (percent < list[i].end) return i;
  }
  return list.length - 1;
}

/** 0..1: how much of a segment a percent has covered. */
function segmentFraction(segment: Segment, percent: number): number {
  const len = segment.end - segment.start;
  if (len <= 0) return percent >= segment.end ? 1 : 0;
  return clamp((percent - segment.start) / len, 0, 1);
}

// The gaps eat pixels, so pixels and time are not linear across the bar:
// inside a segment the drawn length maps to its whole time span, a point in
// a gap snaps to the chapter boundary. Both directions use the same rects,
// so the fill ends exactly under the cursor.
function pxToPercent(px: number, total: number): number {
  if (total <= 0) return 0;
  const inset = segmentInset.value;
  if (!inset || props.vertical) return clamp((px / total) * 100, 0, 100);

  const list = segments.value;
  for (let i = 0; i < list.length; i++) {
    const seg = list[i];
    const right = (seg.end / 100) * total - inset;
    if (px <= right || i === list.length - 1) {
      const left = (seg.start / 100) * total + inset;
      const w = right - left;
      const t = w > 0 ? clamp((px - left) / w, 0, 1) : 0;
      return seg.start + t * (seg.end - seg.start);
    }
  }
  return 100;
}

function percentToPx(percent: number, total: number): number {
  const inset = segmentInset.value;
  if (!inset || props.vertical) return (percent / 100) * total;
  const seg = segments.value[segmentIndexAt(percent)];
  const left = (seg.start / 100) * total + inset;
  const w = Math.max(((seg.end - seg.start) / 100) * total - inset * 2, 0);
  return left + segmentFraction(seg, percent) * w;
}

/** Same as percentToPx, as CSS: stays right while the bar resizes. */
function percentToCss(percent: number): string {
  const inset = segmentInset.value;
  if (!inset || props.vertical) return `${percent}%`;
  const seg = segments.value[segmentIndexAt(percent)];
  const t = segmentFraction(seg, percent);
  return `calc(${seg.start}% + ${inset}px + (${seg.end - seg.start}% - ${inset * 2}px) * ${t})`;
}

/** Writes a per-segment scaleX for `percent` into `els`, skipping unchanged ones. */
function paintSegments(els: (HTMLElement | null)[], last: number[], percent: number, useWidth: boolean): void {
  const list = segments.value;
  for (let i = 0; i < list.length; i++) {
    const el = els[i];
    if (!el) continue;
    const t = segmentFraction(list[i], percent);
    if (last[i] === t) continue;
    last[i] = t;
    if (useWidth) el.style.width = `${t * 100}%`;
    else el.style.transform = `scaleX(${t})`;
  }
}

const hoverSegmentIndex = computed(() => {
  if (!isHovering.value && !mousedown.value) return -1;
  const list = segments.value;
  return list.findIndex((seg, i) =>
    hoverPercent.value >= seg.start
    && (hoverPercent.value < seg.end || i === list.length - 1),
  );
});

const hoverChapterTitle = computed(() => {
  const idx = hoverSegmentIndex.value;
  return idx >= 0 ? segments.value[idx]?.title ?? null : null;
});

function formatTime(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const hoverTimeLabel = computed(() => {
  if (!props.duration || (!isHovering.value && !mousedown.value)) return null;
  return formatTime((hoverPercent.value / 100) * props.duration);
});

const isTooltipOpen = computed(() => props.showTooltip && hoverTimeLabel.value !== null);

// Kept through the close animation: emptied as the pointer leaves, the
// tooltip shrank and jumped while it faded out.
const tooltipTime = ref("");
const tooltipChapter = ref<string | null>(null);
watch([hoverTimeLabel, hoverChapterTitle], ([time, chapter]) => {
  if (time === null) return;
  tooltipTime.value = time;
  tooltipChapter.value = chapter;
});

// The tooltip points at the hovered time, not at the bar: a zero-width rect
// at that spot. It reads hoverPercent, which stays clamped to the bar while
// a drag wanders off it, so the tooltip stops at the bar's ends.
const tooltipAnchor = {
  getBoundingClientRect: () => {
    const rect = containerRef.value?.getBoundingClientRect() ?? new DOMRect();
    const offset = percentToPx(hoverPercent.value, rect.width);
    const x = !props.vertical && isRTL() ? rect.right - offset : rect.left + offset;
    return new DOMRect(x, rect.top, 0, rect.height);
  },
};

function setHoverFilled(percent: number): void {
  paintSegments(hoverFillEls, lastHoverFill, percent, false);
}

function calcPercentFromPosition(x: number, y: number): number {
  let rectMax = props.vertical ? height.value : width.value;

  if (props.offsetAxisValue) {
    rectMax -= props.offsetAxisValue;
  }

  let offsetAxisVal = clamp(
    props.vertical
      ? -(y - bottom.value)
      : x - left.value - props.offsetAxisValue / 2,
    0,
    rectMax,
  );

  if (!props.vertical && isRTL()) {
    offsetAxisVal = rectMax - offsetAxisVal;
  }

  return pxToPercent(offsetAxisVal, rectMax);
}

function setFilled(value: number): void {
  const range = props.max - props.min;
  const percent = range > 0 ? clamp(((value - props.min) / range) * 100, 0, 100) : 0;

  paintSegments(fillEls, lastFill, percent, !props.useTransform);

  if (thumbRef.value) {
    thumbRef.value.style.left = percentToCss(percent);
  }
}

function setProgress(value: number): void {
  if (!seekRef.value) return;

  seekRef.value.value = String(value);
  const clampedValue = Number(seekRef.value.value);
  setFilled(clampedValue);
  internalValue.value = clampedValue;
}

function addProgress(value: number): void {
  const newValue = clamp(internalValue.value + value, props.min, props.max);
  setProgress(newValue);
  emit("update:modelValue", newValue);
  emit("scrub", newValue);
}

function createGrabEvent(e: MouseEvent | TouchEvent): GrabEvent {
  const touch = "touches" in e ? e.touches[0] : null;
  return {
    x: touch ? touch.clientX : (e as MouseEvent).clientX,
    y: touch ? touch.clientY : (e as MouseEvent).clientY,
    originalEvent: e,
  };
}

function scrub(event: GrabEvent, snapValue?: (value: number) => number): number {
  const percent = calcPercentFromPosition(event.x, event.y);
  let value = props.min + (percent / 100) * (props.max - props.min);

  if ((value - props.min) < ((props.max - props.min) / 2)) {
    value -= props.step / 10;
  }

  value = Number(value.toFixed(decimals.value));
  value = clamp(value, props.min, props.max);

  if (snapValue) {
    value = snapValue(value);
  }

  setProgress(value);
  emit("update:modelValue", value);
  emit("scrub", value);

  return value;
}

function onInput(): void {
  if (props.disabled || !seekRef.value) return;

  const value = Number(seekRef.value.value);
  setFilled(value);
  internalValue.value = value;
  emit("update:modelValue", value);
  emit("scrub", value);
}

function onPointerDown(e: MouseEvent | TouchEvent): void {
  if (props.disabled) return;
  const grabEvent = createGrabEvent(e);
  const percent = calcPercentFromPosition(grabEvent.x, grabEvent.y);
  hoverPercent.value = percent;
  isHovering.value = true;
  mousedown.value = true;
  setHoverFilled(percent);
  scrub(grabEvent);
  emit("mousedown", grabEvent);
}

function onPointerMove(e: MouseEvent | TouchEvent): void {
  if (!mousedown.value) return;

  e.preventDefault();
  const grabEvent = createGrabEvent(e);
  const percent = calcPercentFromPosition(grabEvent.x, grabEvent.y);
  hoverPercent.value = percent;
  setHoverFilled(percent);
  scrub(grabEvent);
}

function onPointerUp(e: MouseEvent | TouchEvent): void {
  if (!mousedown.value) return;

  const grabEvent = createGrabEvent(e);
  mousedown.value = false;
  setHoverFilled(0);
  emit("mouseup", grabEvent);
}

function onContainerHover(e: MouseEvent): void {
  if (props.disabled) return;
  const percent = calcPercentFromPosition(e.clientX, e.clientY);
  hoverPercent.value = percent;
  isHovering.value = true;
  setHoverFilled(percent);
}

function onContainerLeave(): void {
  isHovering.value = false;
  setHoverFilled(0);
}

function onKeyDown(e: KeyboardEvent): void {
  if (props.disabled) return;
  const isArrowKey = e.key === "ArrowLeft" || e.key === "ArrowRight"
    || e.key === "ArrowUp" || e.key === "ArrowDown";

  if (!isArrowKey) return;

  e.preventDefault();
  e.stopPropagation();

  const isIncrease = e.key === "ArrowRight" || e.key === "ArrowUp";
  const step = isIncrease ? keyStep.value : -keyStep.value;

  addProgress(step);
}

useEventListener(containerRef, "mousedown", onPointerDown);
useEventListener(containerRef, "touchstart", onPointerDown, { passive: true });
useEventListener(containerRef, "mousemove", onContainerHover);
useEventListener(containerRef, "mouseleave", onContainerLeave);

useEventListener(document, "mousemove", onPointerMove);
useEventListener(document, "mouseup", onPointerUp);
useEventListener(document, "touchmove", onPointerMove, { passive: false });
useEventListener(document, "touchend", onPointerUp);

watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue !== internalValue.value) {
      setProgress(newValue);
    }
  },
);

// New chapters (another track, a loaded chapter list) re-key the segments:
// their fills come back empty, so repaint them from the current value.
watch(segments, (list) => {
  fillEls.length = list.length;
  hoverFillEls.length = list.length;
  lastFill = [];
  lastHoverFill = [];
  setFilled(internalValue.value);
  setHoverFilled(isHovering.value || mousedown.value ? hoverPercent.value : 0);
}, { flush: "post" });

onMounted(() => {
  setProgress(props.modelValue);
});

defineExpose({
  setProgress,
  addProgress,
  getValue: () => internalValue.value,
});
</script>

<style scoped>
.range-selector {
  /* Drawn height is always the hover one; at rest the segments are squashed
     to --range-rest-scale of it. scaleY, not height: no layout per frame,
     and nothing next to the bar moves while it grows. */
  --range-height-hover: 5px;
  --range-rest-scale: 0.6; /* 3px of 5px */
  --range-bg: var(--border);
  --range-bg-hover: var(--muted);
  --range-filled: var(--primary);
  --range-radius: 0;

  position: relative;
  display: flex;
  align-items: flex-end;
  width: 100%;
  height: var(--range-height-hover);
  cursor: pointer;
  touch-action: none;
  user-select: none;
}

.range-selector--disabled {
  cursor: not-allowed;
  opacity: 0.5;
  pointer-events: none;
}

.range-selector__track {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* Each segment carries its own fills, so a gap stays a gap even behind
   the played part. Only the hovered segment grows, like YouTube's chapters;
   with no chapters the one segment is the whole bar. */
.range-selector__segment {
  position: absolute;
  bottom: 0;
  height: var(--range-height-hover);
  overflow: hidden;
  border-radius: var(--range-radius);
  background-color: var(--range-bg);
  transform: scaleY(var(--range-rest-scale));
  transform-origin: center bottom;
  transition: transform 0.15s ease, background-color 0.15s ease;
}

.range-selector__segment--hover {
  transform: scaleY(1);
  background-color: var(--range-bg-hover);
}

.range-selector__filled,
.range-selector__hover-filled {
  position: absolute;
  inset: 0;
  pointer-events: none;
  transform-origin: left center;
  transform: scaleX(0);
}

.range-selector__filled {
  background-color: var(--range-filled);
}

.range-selector__hover-filled {
  visibility: hidden;
  background-color: var(--input);
}

.range-selector--hover-fill .range-selector__hover-filled {
  visibility: visible;
}

/* Width path, kept for hosts that turn the transform off. */
.range-selector:not(.range-selector--transform) .range-selector__filled {
  width: 0;
  transform: none;
}

.range-selector--transition .range-selector__filled {
  transition: width 0.1s linear;
}

.range-selector--active .range-selector__filled,
.range-selector--no-transition .range-selector__filled {
  transition: none !important;
}

.range-selector__input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
  opacity: 0;
  appearance: none;
  -webkit-appearance: none;
}

.range-selector__input:focus-visible {
  outline: none;
}

.range-selector:has(.range-selector__input:focus-visible) {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

/* Outside the segments: never squashed by their scaleY. */
.range-selector__thumb {
  position: absolute;
  bottom: 50%;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: var(--range-filled);
  transform: translate(-50%, 50%);
  pointer-events: none;
}

/* No hover, no "grow on hover": touch devices rest at full height, so the
   touch target is never the thin idle track. */
@media (hover: none) {
  .range-selector {
    --range-rest-scale: 1;
  }
}
</style>
