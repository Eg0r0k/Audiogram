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

// Bottom to top: the first blob paints over the rest.
const WAVE_BLOBS = [4, 3, 2, 1] as const;
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
      >
        <span
          v-for="blob in WAVE_BLOBS"
          :key="blob"
          class="wave-blob"
          :class="`wave-blob-${blob}`"
        />
      </div>

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
/* Blobs move by transform so the drift stays on the compositor; animating
   background-position repainted the tile every frame. A 170% layer placed
   at X% sits at -X * 0.7 / 1.7 of its own size. */
.wave-tile {
  position: relative;
  background-color: #6d4dff;
}

.wave-blob {
  position: absolute;
  top: 0;
  left: 0;
  width: 170%;
  height: 170%;
  animation: 14s ease-in-out infinite alternate;
}

.wave-blob-1 {
  background-image: radial-gradient(circle at 50% 50%, #ff5ea8 0%, rgb(255 94 168 / 0) 62%);
  animation-name: wave-drift-1;
}

.wave-blob-2 {
  background-image: radial-gradient(circle at 50% 50%, #ffb347 0%, rgb(255 179 71 / 0) 58%);
  animation-name: wave-drift-2;
}

.wave-blob-3 {
  background-image: radial-gradient(circle at 50% 50%, #38d9f5 0%, rgb(56 217 245 / 0) 62%);
  animation-name: wave-drift-3;
}

.wave-blob-4 {
  background-image: radial-gradient(circle at 50% 50%, #b47cff 0%, rgb(180 124 255 / 0) 65%);
  animation-name: wave-drift-4;
}

@keyframes wave-drift-1 {
  0% { transform: translate(0, 0); }
  33% { transform: translate(-32.94%, -12.35%); }
  66% { transform: translate(-41.18%, -41.18%); }
  100% { transform: translate(-12.35%, -37.06%); }
}

@keyframes wave-drift-2 {
  0% { transform: translate(-41.18%, -8.24%); }
  33% { transform: translate(-8.24%, -41.18%); }
  66% { transform: translate(0, 0); }
  100% { transform: translate(-37.06%, -28.82%); }
}

@keyframes wave-drift-3 {
  0% { transform: translate(-16.47%, -41.18%); }
  33% { transform: translate(-41.18%, 0); }
  66% { transform: translate(-8.24%, -16.47%); }
  100% { transform: translate(0, 0); }
}

@keyframes wave-drift-4 {
  0% { transform: translate(-41.18%, -41.18%); }
  33% { transform: translate(0, -24.71%); }
  66% { transform: translate(-28.82%, -4.12%); }
  100% { transform: translate(-16.47%, -41.18%); }
}

@media (prefers-reduced-motion: reduce) {
  .wave-blob { animation: none; }
}
</style>
