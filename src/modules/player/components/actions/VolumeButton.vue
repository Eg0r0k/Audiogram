<template>
  <div
    ref="containerRef"
    class="relative"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
  >
    <Button
      ref="buttonRef"
      size="icon-sm"
      variant="ghost-primary"
      class="rounded-full"
      :aria-label="$t('player.volume')"
      aria-haspopup="true"
      :aria-expanded="isVisible"
      @click="toggleMute"
      @mouseenter="showTooltip"
      @mouseleave="scheduleHide"
      @focus="showTooltip"
      @blur="scheduleHide"
    >
      <component
        :is="volumeIcon"
        class="size-4.5"
      />
    </Button>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -->
      <div
        v-if="isVisible"
        ref="tooltipRef"
        role="tooltip"
        :class="[
          'absolute p-2 shadow-lg bg-card rounded-md z-100',
          positionClasses
        ]"
        @mouseenter="showTooltip"
        @mouseleave="scheduleHide"
        @focus="showTooltip"
        @blur="scheduleHide"
      >
        <Slider
          v-if="position === 'top'"
          :model-value="[volumePercent]"
          :max="100"
          :step="1"
          orientation="vertical"
          class="h-16! min-h-0! cursor-pointer"
          @update:model-value="onVolumeChange"
          @pointerdown="onSliderInteractionStart"
          @pointerup="onSliderInteractionEnd"
        />

        <Slider
          v-else
          :model-value="[volumePercent]"
          :max="100"
          :step="1"
          orientation="horizontal"
          class="w-20! min-w-0! cursor-pointer"
          @update:model-value="onVolumeChange"
          @pointerdown="onSliderInteractionStart"
          @pointerup="onSliderInteractionEnd"
        />
      </div>
    </Transition>
  </div>
</template>

<script lang="ts" setup>
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { unrefElement, useEventListener } from "@vueuse/core";
import { computed, ref, useTemplateRef, watch } from "vue";

import IconVolumeOff from "~icons/tabler/volume-off";
import IconVolume2 from "~icons/tabler/volume-2";
import IconVolume from "~icons/tabler/volume";
import { usePlayerStore } from "@/modules/player/store/player.store";

const playerStore = usePlayerStore();

const containerRef = useTemplateRef("containerRef");
const buttonRef = useTemplateRef("buttonRef");
const tooltipRef = useTemplateRef("tooltipRef");

const isVisible = ref(false);
const position = ref<"top" | "right">("top");
const isInteracting = ref(false);
const isFocusWithin = ref(false);

const MIN_TOP_SPACE = 120;

const lastVolume = ref(playerStore.volume > 0 ? playerStore.volume : 0.5);

const volumePercent = computed(() => {
  if (playerStore.isMuted) return 0;
  return Math.round(playerStore.volume * 100);
});

const volumeIcon = computed(() => {
  if (playerStore.isMuted || playerStore.volume === 0) return IconVolumeOff;
  if (playerStore.volume < 0.3) return IconVolume2;
  return IconVolume;
});

const positionClasses = computed(() => {
  if (position.value === "top") {
    return "bottom-full mb-2 left-1/2 -translate-x-1/2 origin-bottom";
  }
  return "left-full ml-2 top-1/2 -translate-y-1/2 origin-left";
});

const calculatePosition = () => {
  const container = unrefElement(containerRef);
  if (!container) return;

  const rect = container.getBoundingClientRect();
  const spaceAbove = rect.top;

  position.value = spaceAbove >= MIN_TOP_SPACE ? "top" : "right";
};

let hideTimeout: ReturnType<typeof setTimeout> | null = null;

const cancelHide = () => {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
};

const showTooltip = () => {
  cancelHide();
  calculatePosition();
  isVisible.value = true;
};

const scheduleHide = () => {
  cancelHide();
  hideTimeout = setTimeout(() => {
    if (!isInteracting.value && !isFocusWithin.value) {
      isVisible.value = false;
    }
  }, 150);
};

const forceHide = () => {
  cancelHide();
  if (!isInteracting.value && !isFocusWithin.value) {
    isVisible.value = false;
  }
};

const onFocusIn = () => {
  isFocusWithin.value = true;
  showTooltip();
};

const onFocusOut = (e: FocusEvent) => {
  const container = unrefElement(containerRef);
  const relatedTarget = e.relatedTarget as Node | null;

  if (container && relatedTarget && container.contains(relatedTarget)) {
    return;
  }

  isFocusWithin.value = false;
  scheduleHide();
};

const onSliderInteractionStart = () => {
  isInteracting.value = true;
  cancelHide();
};

const onSliderInteractionEnd = () => {
  isInteracting.value = false;
};

const onVolumeChange = (value: number[] | undefined) => {
  if (!value || value.length === 0) return;

  const newVolume = value[0] / 100;

  if (newVolume > 0) {
    lastVolume.value = newVolume;
  }

  playerStore.setVolume(newVolume);

  if (playerStore.isMuted && newVolume > 0) {
    playerStore.setMuted(false);
  }
};

const handleScroll = (e: WheelEvent) => {
  e.preventDefault();
  const step = 0.05;
  const current = playerStore.isMuted ? 0 : playerStore.volume;
  const newVolume = e.deltaY > 0
    ? Math.max(0, current - step)
    : Math.min(1, current + step);

  if (newVolume > 0 && playerStore.isMuted) {
    playerStore.setMuted(false);
  }

  playerStore.setVolume(newVolume);

  if (newVolume > 0) {
    lastVolume.value = newVolume;
  }
};

const toggleMute = () => {
  if (playerStore.isMuted || playerStore.volume === 0) {
    playerStore.setMuted(false);
    playerStore.setVolume(lastVolume.value > 0 ? lastVolume.value : 0.5);
  }
  else {
    lastVolume.value = playerStore.volume;
    playerStore.toggleMute();
  }
};

watch(
  () => playerStore.volume,
  (vol) => {
    if (vol > 0 && !playerStore.isMuted) {
      lastVolume.value = vol;
    }
  },
);

useEventListener(
  () => unrefElement(buttonRef),
  "wheel",
  handleScroll,
  { passive: false },
);

useEventListener(tooltipRef, "wheel", handleScroll, { passive: false });

useEventListener(window, "scroll", calculatePosition, { passive: true });
useEventListener(window, "resize", calculatePosition, { passive: true });

useEventListener(document, "pointerdown", (e: PointerEvent) => {
  if (!isVisible.value) return;

  const container = unrefElement(containerRef);
  const target = e.target as Node;

  if (container && !container.contains(target)) {
    forceHide();
  }
});
</script>
