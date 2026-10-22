<template>
  <NuxtImage
    :src="src"
    :fallback-src="placeholderSrc"
    :alt="alt"
    :class="[imageClass, isPending && 'bg-muted']"
    :placeholder="placeholder"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import { useEntityCover } from "@/modules/covers/composables/useEntityCover";
import { placeholderCoverUrl } from "@/modules/covers/lib/placeholder";
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
  fallbackSrc: undefined,
  imageClass: "",
  placeholder: false,
});

// An empty src would paint the alt text; this keeps the box blank instead.
const BLANK_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const { url, isLoading } = useEntityCover(
  computed(() => props.ownerType),
  computed(() => props.ownerId),
);

const placeholderSrc = computed(() => placeholderCoverUrl(props.ownerType, props.ownerId));

// The placeholder waits for the lookup: shown earlier, it flashes before a real cover.
const isPending = computed(() => !url.value && !props.fallbackSrc && isLoading.value);

const src = computed(() => {
  if (url.value) return url.value;
  if (props.fallbackSrc) return props.fallbackSrc;
  return isPending.value ? BLANK_PIXEL : placeholderSrc.value;
});
</script>
