<template>
  <MediaContextMenu
    :context="contextType"
    :is-playlist-owner="isPlaylist(data) ? data.isOwner : undefined"
  >
    <div
      class="relative"
      data-media-context
    >
      <div
        class="absolute inset-0 transition-opacity duration-400 ease-standard pointer-events-none"
        :class="colorReady ? 'opacity-100' : 'opacity-0'"
        :style="{ background: `linear-gradient(${color.hsl} 0%, transparent 140%)` }"
      />

      <MediaHeader
        :title="data.title"
        :color="colorReady ? color.hsl : null"
        @play="$emit('play')"
      />

      <div class="relative flex flex-col pt-[72px] lg:flex-row lg:items-end px-4 lg:px-7 pb-6 lg:pb-7 min-h-[265px]">
        <div class="flex  justify-center lg:hidden mb-4">
          <MediaHeroImage
            :src="data.image"
            :alt="data.title"
            :rounded="isArtist(data)"
            :editable="canEdit"
            :fallback-src="fallbackSrc"
            class="size-48"
            @edit="$emit('edit')"
          />
        </div>

        <div class="hidden lg:block shrink-0 mr-7 w-[232px]">
          <MediaHeroImage
            :src="data.image"
            :alt="data.title"
            :rounded="isArtist(data)"
            :editable="canEdit"
            :fallback-src="fallbackSrc"
            @edit="$emit('edit')"
          />
        </div>

        <div class="flex flex-col w-full select-none text-white min-w-0 text-center lg:text-left @container">
          <span class="text-xs lg:text-sm font-medium mb-1 opacity-90">
            {{ typeLabel }}
          </span>

          <h1
            class="font-black tracking-tight truncate
               text-2xl @lg:text-3xl @md:text-4xl @lg:text-5xl @xl:text-6xl
               leading-tight"
          >
            {{ data.title }}
          </h1>

          <MediaHeroMeta
            class="mt-2 justify-center lg:justify-start text-white font-medium"
            :data="data"
          />
          <MediaHeroActions
            class="mt-4 lg:mt-6"
            :type="data.type"
            :source="heroSource"
            :is-playlist-owner="isPlaylist(data) ? data.isOwner : undefined"
            @play="$emit('play')"
            @shuffle="$emit('shuffle')"
          />
        </div>
      </div>
    </div>
  </MediaContextMenu>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useImageColor } from "@/composables/useImageColor";
import { provideMediaContext } from "@/composables/useMediaContext";
import MediaHeader from "./MediaHeader.vue";
import MediaHeroImage from "./MediaHeroImage.vue";
import MediaContextMenu from "./menu/context-menu/MediaContextMenu.vue";
import MediaHeroMeta from "./MediaHeroMeta.vue";
import MediaHeroActions from "./MediaHeroActions.vue";
import type { QueueSource } from "@/modules/queue/types";
import { isAlbum, isArtist, isLiked, isPlaylist, MediaData } from "../types";

const props = defineProps<{
  data: MediaData;
}>();

const emit = defineEmits<{
  edit: [];
  delete: [];
  play: [];
  shuffle: [];
  addToQueue: [];
  share: [];
}>();

const { t } = useI18n();

const fallbackSrc = computed(() => {
  return isArtist(props.data)
    ? "/img/artist-fallback.svg"
    : "/img/fallback.svg";
});

provideMediaContext({
  addToQueue: () => emit("addToQueue"),
  edit: () => emit("edit"),
  delete: () => emit("delete"),
  share: () => emit("share"),
});

const { color, extractColor, resetColor } = useImageColor();
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

const heroSource = computed<QueueSource>(() => {
  const d = props.data;
  if (isAlbum(d)) return { type: "album", albumId: d.id };
  if (isArtist(d)) return { type: "artist", artistId: d.id };
  if (isPlaylist(d)) return { type: "playlist", playlistId: d.id };
  if (isLiked(d)) return { type: "liked" };
  return { type: "unknown" };
});

const canEdit = computed(() => {
  if (isPlaylist(props.data)) return props.data.isOwner;
  if (isAlbum(props.data)) return true;
  return false;
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
