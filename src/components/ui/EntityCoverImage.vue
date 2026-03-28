<template>
  <NuxtImage
    :src="src"
    :fallback-src="fallbackSrc"
    :alt="alt"
    :class="imageClass"
    :placeholder="placeholder"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import { useEntityCover } from "@/modules/covers/composables/useEntityCover";
import type { CoverOwnerType } from "@/db/entities";

const props = withDefaults(defineProps<{
  ownerType?: CoverOwnerType | null;
  ownerId?: string | null;
  alt: string;
  fallbackSrc?: string;
  imageClass?: string;
  placeholder?: boolean;
}>(), {
  ownerType: null,
  ownerId: null,
  fallbackSrc: "/img/fallback.svg",
  imageClass: "",
  placeholder: false,
});

const { url } = useEntityCover(
  computed(() => props.ownerType),
  computed(() => props.ownerId),
);

const src = computed(() => url.value ?? props.fallbackSrc);
</script>
