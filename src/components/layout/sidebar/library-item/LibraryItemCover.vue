<script setup lang="ts">
import { computed } from "vue";
import type { CoverOwnerType } from "@/db/entities";
import type { LibraryItem } from "@/modules/library/types";
import { ItemMedia } from "@/components/ui/item";
import EntityCoverImage from "@/components/ui/EntityCoverImage.vue";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import IconFolder from "~icons/tabler/folder-filled";
import IconPinFilled from "~icons/tabler/pin-filled";
import IconVolume from "~icons/tabler/volume";

const props = defineProps<{
  item: LibraryItem;
  coverOwnerType: CoverOwnerType | null;
  coverOwnerId: string | null;
  compact?: boolean;
  active?: boolean;
  isPlaybackSource?: boolean;
}>();

const hasStaticImage = computed(() => !!props.item.image);
</script>

<template>
  <div class="relative  shrink-0 mb-px">
    <ItemMedia
      class="size-[55px] aspect-square relative z-1 overflow-hidden "
      :class="item.rounded ? 'rounded-full' : 'rounded-md'"
    >
      <NuxtImage
        v-if="hasStaticImage"
        :src="item.image"
        :placeholder="item.imageLow"
        placeholder-class="blur-md scale-110"
        :alt="item.title"
        class="object-cover transition-[filter,scale] duration-300"
      />

      <div
        v-else-if="item.type === 'folder'"
        class="size-full rounded-md bg-[#3d3d3d] text-primary flex items-center justify-center"
      >
        <IconFolder class="size-8" />
      </div>

      <div
        v-else-if="item.type === 'radio'"
        class="wave-tile size-full"
      />

      <EntityCoverImage
        v-else
        :owner-type="coverOwnerType"
        :owner-id="coverOwnerId"
        :alt="item.title"
        class="size-full object-cover"
        :image-class="item.rounded
          ? 'size-full object-cover rounded-full'
          : 'size-full object-cover rounded-md'"
      />

      <div
        v-if="compact && isPlaybackSource"
        class="absolute inset-0 z-10 flex items-center justify-center bg-black/50"
      >
        <IconVolume class="size-6 text-white" />
      </div>
    </ItemMedia>

    <span
      v-if="compact && item.isPinned"
      class="absolute -top-1 -right-1 z-10 flex size-5 items-center justify-center"
    >
      <IconPinFilled
        :class="active ? 'text-white' : 'text-primary'"
        class="size-5"
      />
    </span>
  </div>
</template>

<style scoped>
/* The station has no cover of its own: soft colour blobs drifting over a
   base tone stand in for one. Radial falloffs fade into the same hue at
   zero alpha, so there is no hard seam for the rasteriser to band on. */
.wave-tile {
  background-color: #6d4dff;
  background-image:
    radial-gradient(circle at 50% 50%, #ff5ea8 0%, rgb(255 94 168 / 0) 62%),
    radial-gradient(circle at 50% 50%, #ffb347 0%, rgb(255 179 71 / 0) 58%),
    radial-gradient(circle at 50% 50%, #38d9f5 0%, rgb(56 217 245 / 0) 62%),
    radial-gradient(circle at 50% 50%, #b47cff 0%, rgb(180 124 255 / 0) 65%);
  background-size: 170% 170%;
  background-repeat: no-repeat;
  animation: wave-drift 14s ease-in-out infinite alternate;
}

@keyframes wave-drift {
  0% { background-position: 0% 0%, 100% 20%, 40% 100%, 100% 100%; }
  33% { background-position: 80% 30%, 20% 100%, 100% 0%, 0% 60%; }
  66% { background-position: 100% 100%, 0% 0%, 20% 40%, 70% 10%; }
  100% { background-position: 30% 90%, 90% 70%, 0% 0%, 40% 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .wave-tile { animation: none; }
}
</style>
