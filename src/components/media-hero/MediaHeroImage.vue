<template>
  <div class="relative group select-none">
    <div :class="containerClass">
      <NuxtImage
        :src="src"
        :alt="alt"
        :width="232"
        :height="232"
        loading="eager"
        class="size-full object-cover"
        :fallback-src="fallbackSrc"
      />
    </div>

    <button
      v-if="editable"
      type="button"
      class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
      :class="rounded ? 'rounded-full' : 'rounded-md'"
      @click="emit('edit')"
    >
      <div class="text-center text-white">
        <IconPencil class="size-12 mx-auto mb-2" />
        <span class="text-sm font-semibold block">{{ $t('media.editImage') }}</span>
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import IconPencil from "~icons/tabler/pencil";
import NuxtImage from "../ui/image/NuxtImage.vue";

const props = withDefaults(defineProps<{
  src: string;
  alt: string;
  rounded?: boolean;
  editable?: boolean;
  fallbackSrc?: string;
}>(), {
  rounded: false,
  editable: false,
  fallbackSrc: "/img/fallback.svg",

});

const emit = defineEmits<{
  edit: [];
}>();

const containerClass = computed(() => {
  const base = "w-full max-w-[232px] shadow-xl aspect-square overflow-hidden";
  return props.rounded
    ? `${base} rounded-full`
    : `${base} rounded-md`;
});
</script>
