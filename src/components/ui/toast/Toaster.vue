<script setup lang="ts">
import { injectOverlayPortalTarget } from "@kappa-ui/core/overlay";
import {
  ToastPortal,
  ToastProvider,
  ToastRecordRoot,
  ToastViewport,
  useToastGroup,
  useToastStack,
} from "@kappa-ui/core/toast";
import { useDirection } from "reka-ui";
import { type HTMLAttributes, computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { cn } from "@/lib/utils";
import type { Toast, ToastContent, ToastPosition } from ".";
import ToastRow from "./ToastRow.vue";

const props = withDefaults(
  defineProps<{
    group?: string;
    position?: ToastPosition;
    expand?: boolean;
    max?: number;
    duration?: number;
    progress?: boolean;
    label?: string;
    hotkey?: string[];
    class?: HTMLAttributes["class"];
  }>(),
  {
    position: "bottom-end",
    max: 5,
    duration: 5000,
    hotkey: () => ["F8"],
  },
);

defineSlots<{ toast?: (props: { toast: Toast }) => unknown }>();

const { t } = useI18n();
const toastLabel = computed(() => props.label ?? t("common.toastLabel"));
const regionLabel = computed(() => t("common.toastRegion", { hotkey: props.hotkey.join("+") }));

const timed = (toast: Toast) =>
  !toast.loading && (toast.duration === undefined || (toast.duration > 0 && Number.isFinite(toast.duration)));

const { manager, toasts } = useToastGroup<ToastContent>(
  () => props.group,
  () => Number.POSITIVE_INFINITY,
);
// Over the limit only toasts that would time out anyway are closed: one waiting
// for the user stays even if that keeps the stack over max.
watch(
  [toasts, () => props.max],
  ([list, max]) => {
    const open = list.filter(toast => toast.open);
    open
      .filter(timed)
      .slice(0, Math.max(open.length - max, 0))
      .forEach(toast => manager.remove(toast.id));
  },
  { immediate: true },
);
const stack = useToastStack(toasts);
const dir = useDirection();
const portalTarget = injectOverlayPortalTarget(null);
const paused = ref(false);
watch(
  () => toasts.value.length === 0,
  (empty) => {
    if (empty) paused.value = false;
  },
);

const side = computed(() => (props.position.startsWith("top") ? "top" : "bottom"));
const align = computed(() => props.position.split("-")[1] as "start" | "center" | "end");
const swipeDirection = computed(() => {
  if (align.value === "center") return side.value === "top" ? "up" : "down";
  return (align.value === "end") === (dir.value !== "rtl") ? "right" : "left";
});

const place = (toast: Toast) => {
  const layout = stack.layout.value.get(toast.id);
  return {
    "--toast-index": layout?.index ?? 0,
    "--toast-offset": `${layout?.offset ?? 0}px`,
    "--toast-height": `${layout?.height ?? 0}px`,
  };
};
</script>

<template>
  <ToastProvider
    :label="toastLabel"
    :duration="props.duration"
    :swipe-direction="swipeDirection"
  >
    <ToastRecordRoot
      v-for="toast in toasts"
      :key="toast.id"
      v-slot="{ duration: remaining }"
      :toast="toast"
      data-slot="toast"
      :data-color="toast.color ?? 'neutral'"
      :style="place(toast)"
      class="kappa-toast overflow-hidden rounded-surface-lg bg-popover text-popover-foreground shadow-shadow-popover ring-1 [--scroll-fade-color:var(--popover)] ring-surface-border outline-none focus-visible:focus-ring"
      @pause="paused = true"
      @resume="paused = false"
    >
      <div
        :ref="stack.measure(toast.id)"
        data-slot="toast-content"
        class="kappa-toast-content px-3.5 py-2.5"
      >
        <slot
          name="toast"
          :toast="toast"
        >
          <ToastRow :toast="toast" />
        </slot>
      </div>
      <div
        v-if="props.progress && timed(toast)"
        :key="`${remaining}:${toast.open}`"
        data-slot="toast-progress"
        class="kappa-toast-progress absolute inset-x-0 bottom-0 h-0.5 bg-tone-text"
        :style="{ animationDuration: `${remaining}ms` }"
      />
    </ToastRecordRoot>
    <ToastPortal :to="portalTarget ?? undefined">
      <ToastViewport
        :hotkey="props.hotkey"
        :label="regionLabel"
        :dir="dir"
        data-slot="toaster"
        :data-side="side"
        :data-align="align"
        :data-expand="props.expand || undefined"
        :data-paused="paused || undefined"
        :style="{
          '--toast-front-height': `${stack.front.value}px`,
          '--toast-total-height': `${stack.total.value}px`,
          '--toast-count': stack.count.value,
        }"
        :class="cn('kappa-toaster z-100 outline-none', props.class)"
      />
    </ToastPortal>
  </ToastProvider>
</template>

<style>
@layer components {
  .kappa-toaster {
    --toast-gap: 0.75rem;
    --toast-peek: 0.625rem;
    --toast-inset: 1rem;
    --toast-sign: -1;
    position: fixed;
    width: min(356px, calc(100vw - 2 * var(--toast-inset)));
    height: calc(var(--toast-front-height) + (min(var(--toast-count), 3) - 1) * var(--toast-peek));
    transition: height var(--transition-duration-medium-4, 400ms)
      var(--ease-emphasized-decelerate, cubic-bezier(0.05, 0.7, 0.1, 1));

    &[data-side="bottom"] {
      bottom: calc(var(--toast-inset) + env(safe-area-inset-bottom, 0px));
    }

    &[data-side="top"] {
      --toast-sign: 1;
      top: calc(var(--toast-inset) + env(safe-area-inset-top, 0px));
    }

    &[data-align="start"] {
      inset-inline-start: var(--toast-inset);
    }

    &[data-align="end"] {
      inset-inline-end: var(--toast-inset);
    }

    &[data-align="center"] {
      left: 50%;
      translate: -50% 0;
    }

    &:is(:hover, :focus-within, [data-expand]) {
      height: calc(var(--toast-total-height) + (var(--toast-count) - 1) * var(--toast-gap));
    }
  }

  .kappa-toast {
    --toast-y: calc(var(--toast-sign) * min(var(--toast-index), 2) * var(--toast-peek));
    pointer-events: auto;
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    z-index: calc(100 - var(--toast-index));
    /* min- and max-height rather than height: Reka UI 2.11 measures a toast by setting its inline height to auto,
       which would cut a height transition short */
    min-height: var(--toast-front-height);
    max-height: var(--toast-front-height);
    translate: 0 var(--toast-y);
    scale: calc(1 - min(var(--toast-index), 3) * 0.05);
    transform-origin: 50% 100%;
    opacity: calc(1 - max(var(--toast-index) - 2, 0));
    transition-property: translate, scale, min-height, max-height, opacity, transform;
    transition-duration: var(--transition-duration-medium-4, 400ms);
    transition-timing-function: var(--ease-emphasized-decelerate, cubic-bezier(0.05, 0.7, 0.1, 1));

    .kappa-toaster[data-side="top"] > & {
      top: 0;
      bottom: auto;
      transform-origin: 50% 0;
    }

    .kappa-toaster:is(:hover, :focus-within, [data-expand]) > & {
      --toast-y: calc(var(--toast-sign) * (var(--toast-offset) + var(--toast-index) * var(--toast-gap)));
      min-height: var(--toast-height);
      max-height: var(--toast-height);
      scale: 1;
      opacity: 1;
    }

    &[data-state="open"] {
      animation: kappa-toast-in var(--transition-duration-medium-4, 400ms)
        var(--ease-emphasized-decelerate, cubic-bezier(0.05, 0.7, 0.1, 1));
    }

    &[data-state="closed"] {
      animation: kappa-toast-out var(--transition-duration-short-4, 200ms)
        var(--ease-standard-decelerate, cubic-bezier(0, 0, 0, 1)) forwards;
    }

    &[data-swipe-direction="right"] {
      --toast-swipe-x: 100%;
    }

    &[data-swipe-direction="left"] {
      --toast-swipe-x: -100%;
    }

    &[data-swipe-direction="up"] {
      --toast-swipe-y: -100%;
    }

    &[data-swipe-direction="down"] {
      --toast-swipe-y: 100%;
    }

    &[data-swipe="move"] {
      transform: translate(var(--reka-toast-swipe-move-x, 0px), var(--reka-toast-swipe-move-y, 0px));
      transition-property: translate, scale, min-height, max-height, opacity;
    }

    &[data-swipe="end"] {
      animation: kappa-toast-swipe-out var(--transition-duration-short-4, 200ms)
        var(--ease-standard-decelerate, cubic-bezier(0, 0, 0, 1)) forwards;
    }
  }

  .kappa-toast-content {
    opacity: calc(1 - min(var(--toast-index), 1));
    transition: opacity var(--transition-duration-short-4, 200ms) linear;

    .kappa-toaster:is(:hover, :focus-within, [data-expand]) & {
      opacity: 1;
    }
  }

  .kappa-toast-progress {
    transform-origin: left;
    animation: kappa-toast-progress linear forwards;

    &:dir(rtl) {
      transform-origin: right;
    }

    .kappa-toaster[data-paused] & {
      animation-play-state: paused;
    }
  }

  @keyframes kappa-toast-in {
    from {
      opacity: 0;
      transform: translateY(calc(var(--toast-sign) * -100%));
    }
  }

  @keyframes kappa-toast-out {
    to {
      opacity: 0;
      transform: translateY(calc(var(--toast-sign) * -25%));
    }
  }

  @keyframes kappa-toast-swipe-out {
    from {
      transform: translate(var(--reka-toast-swipe-end-x, 0px), var(--reka-toast-swipe-end-y, 0px));
    }
    to {
      opacity: 0;
      transform: translate(var(--toast-swipe-x, 0px), var(--toast-swipe-y, 0px));
    }
  }

  @keyframes kappa-toast-progress {
    to {
      scale: 0 1;
    }
  }

  @keyframes kappa-toast-fade-in {
    from {
      opacity: 0;
    }
  }

  @keyframes kappa-toast-fade-out {
    to {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .kappa-toaster,
    .kappa-toast {
      transition-property: opacity;
    }

    .kappa-toast[data-state="open"] {
      animation-name: kappa-toast-fade-in;
    }

    .kappa-toast:is([data-state="closed"], [data-swipe="end"]) {
      animation-name: kappa-toast-fade-out;
    }
  }
}
</style>
