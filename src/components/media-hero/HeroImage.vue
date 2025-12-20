<template>
  <div class="relative group">
    <Image
      :src="src"
      :alt="alt"
      :width="232"
      :height="232"
      fetchpriority="high"
      :container-class="containerClass"
      image-class="size-full object-cover"
    >
      <button
        v-if="editable"
        class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        :class="rounded ? 'rounded-full' : 'rounded-md'"
        @click="emit('edit')"
      >
        <div class="text-center text-white">
          <Icon
            icon="tabler:pencil"
            class="size-12 mx-auto"
          />
          <span class="text-sm mt-2 block">{{ $t('media.editImage') }}</span>
        </div>
      </button>
    </Image>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Image from "@/components/ui/image/Image.vue";
import { Icon } from "@iconify/vue";

const props = withDefaults(defineProps<{
  src: string;
  alt: string;
  rounded?: boolean;
  editable?: boolean;
}>(), {
  rounded: false,
  editable: false,
});

const emit = defineEmits<{
  edit: [];
}>();

const containerClass = computed(() => {
  const base = "w-full h-full max-w-[232px] shadow-xl";
  return props.rounded
    ? `${base} rounded-full aspect-square`
    : `${base} rounded-md`;
});
</script>
