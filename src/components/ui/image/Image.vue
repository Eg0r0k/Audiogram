<template>
  <div
    class="app-image"
    :class="containerClass"
  >
    <div
      v-if="isLoading && showSkeleton"
      class="app-image__skeleton"
    >
      <slot name="skeleton">
        <div class="app-image__skeleton-default" />
      </slot>
    </div>

    <div
      v-else-if="error && !isLoading"
      class="app-image__fallback"
    >
      <slot name="fallback">
        <div class="app-image__fallback-default">
          <Icon
            icon="tabler:photo-off"
            class="size-8"
          />
        </div>
      </slot>
    </div>

    <img
      v-show="isReady && !error"
      ref="imgRef"
      v-bind="imgAttrs"
      :src="currentSrc"
      :alt="alt"
      :class="imageClass"
      :crossorigin="crossorigin"
      :draggable="draggable"
      @load="onLoad"
      @error="onError"
    >
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { useImage } from "@vueuse/core";
import { computed, type HTMLAttributes, ref, useAttrs, useTemplateRef, watch } from "vue";

interface Props {
  src: string;
  alt?: string;
  fallbackSrc?: string;
  crossorigin?: "anonymous" | "use-credentials" | "";
  draggable?: boolean;
  showSkeleton?: boolean;
  containerClass?: HTMLAttributes["class"];
  imageClass?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), {
  alt: "",
  fallbackSrc: "/img/fallback.svg",
  crossorigin: "anonymous",
  draggable: false,
  showSkeleton: true,
});

const emit = defineEmits<{
  load: [event: Event];
  error: [event: Event];
  ready: [src: string];
}>();

const attrs = useAttrs();
const imgRef = useTemplateRef("imgRef");

const imgAttrs = computed(() => {
  const { class: _, style: __, ...rest } = attrs;
  return rest;
});

const useFallback = ref(false);

const currentSrc = computed(() => {
  if (useFallback.value && props.fallbackSrc) {
    return props.fallbackSrc;
  }
  return props.src;
});

const { isLoading, isReady, error } = useImage(() => ({
  src: currentSrc.value,
  crossorigin: props.crossorigin,
}));

watch(() => props.src, () => {
  useFallback.value = false;
});

const onLoad = (event: Event) => {
  emit("load", event);
  emit("ready", currentSrc.value);
};

const onError = (event: Event) => {
  if (!useFallback.value && props.fallbackSrc) {
    useFallback.value = true;
  }
  emit("error", event);
};

defineExpose({
  imgRef,
  isLoading,
  isReady,
  error,
});
</script>

<style scoped>
.app-image {
  position: relative;
  overflow: hidden;
}

.app-image__skeleton,
.app-image__fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: inherit;
}

.app-image__skeleton-default,
.app-image__fallback-default {
  width: 100%;
  height: 100%;
  border-radius: inherit;
}

.app-image__skeleton-default {
  background: linear-gradient(
    90deg,
    rgb(255 255 255 / 5%) 25%,
    rgb(255 255 255 / 10%) 50%,
    rgb(255 255 255 / 5%) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.app-image__fallback-default {
  background: rgb(255 255 255 / 5%);
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
