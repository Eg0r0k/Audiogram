<template>
  <MediaContextMenu :context="contextType">
    <div class="relative">
      <div
        class="absolute inset-0 h-[420px] sm:h-[340px] transition-opacity duration-400 ease-standard pointer-events-none"
        :class="colorReady ? 'opacity-100' : 'opacity-0'"
        :style="{ background: `linear-gradient(${color.hsl} 0%, transparent 100%)` }"
      />

      <MediaHeader
        :title="data.title"
        @play="$emit('play')"
      />

      <div class="relative flex flex-col pt-[72px] sm:flex-row sm:items-end px-4 sm:px-7 pb-6 sm:pb-7 min-h-[265px]">
        <div class="flex justify-center sm:hidden mb-4">
          <MediaHeroImage
            :src="data.image"
            :alt="data.title"
            :rounded="isArtist(data)"
            :editable="canEdit"
            class="size-48"
            @edit="$emit('edit')"
          />
        </div>

        <div class="hidden sm:block shrink-0 mr-7">
          <MediaHeroImage
            :src="data.image"
            :alt="data.title"
            :rounded="isArtist(data)"
            :editable="canEdit"
            @edit="$emit('edit')"
          />
        </div>

        <div class="flex flex-col w-full text-white min-w-0 text-center sm:text-left">
          <span class="text-xs sm:text-sm font-medium mb-1 opacity-90">
            {{ typeLabel }}
          </span>

          <h1
            class="font-black tracking-tight line-clamp-2"
            :class="titleClass"
          >
            {{ data.title }}
          </h1>

          <MediaHeroMeta
            class="mt-2 justify-center sm:justify-start"
            :data="data"
          />

          <MediaHeroActions
            class="mt-4 sm:mt-6"
            :type="data.type"
            @play="$emit('play')"
          />
        </div>
      </div>
    </div>
  </MediaContextMenu>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { isArtist, isPlaylist, isAlbum, MediaData } from "./types";
import { useImageColor } from "@/composables/useImageColor";
import { provideMediaContext } from "@/composables/useMediaContext";
import MediaHeader from "./MediaHeader.vue";
import MediaHeroImage from "./MediaHeroImage.vue";
import MediaContextMenu from "./menu/context-menu/MediaContextMenu.vue";
import MediaHeroMeta from "./MediaHeroMeta.vue";
import MediaHeroActions from "./MediaHeroActions.vue";

const props = defineProps<{
  data: MediaData;
}>();

const emit = defineEmits<{
  edit: [];
  delete: [];
  play: [];
  addToQueue: [];
  share: [];
}>();

const { t } = useI18n();

provideMediaContext({
  addToQueue: () => emit("addToQueue"),
  edit: () => emit("edit"),
  delete: () => emit("delete"),
  share: () => emit("share"),
});

const { color, extractColor, resetColor } = useImageColor({
  colorType: "Muted",
  lightness: 38,
  saturation: 47,
});

const colorReady = ref(false);

watch(
  () => props.data.image,
  async (newImage, oldImage) => {
    if (newImage === oldImage) return;

    colorReady.value = false;

    await nextTick();

    if (newImage) {
      await extractColor(newImage);
    }
    else {
      resetColor();
    }

    colorReady.value = true;
  },
  { immediate: true },
);

const canEdit = computed(() => {
  if (isPlaylist(props.data)) return props.data.isOwner;
  if (isAlbum(props.data)) return true;
  return false;
});

const titleClass = computed(() => {
  const len = props.data.title.length;
  if (len <= 14) return "text-6xl leading-none";
  if (len <= 28) return "text-5xl leading-tight";
  if (len <= 48) return "text-4xl leading-tight";
  return "text-2xl leading-snug";
});

const contextType = computed(() => {
  switch (props.data.type) {
    case "artist": return "artist-page";
    case "liked": return "liked";
    case "playlist": return "playlist";
    case "album": return "album";
    default: return "album";
  }
});

const typeLabel = computed(() => {
  switch (props.data.type) {
    case "playlist": return t("media.type.playlist");
    case "artist": return t("media.type.artist");
    case "album": return t("media.type.album");
    case "liked": return t("media.type.playlist");
    default: return t("media.type.album");
  }
});
</script>
