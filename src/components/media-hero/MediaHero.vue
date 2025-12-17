<template>
  <MediaContextMenu :context="contextType">
    <div
      class="relative flex items-end px-6 pb-6 ml-px h-[32vh] min-h-[260px] max-h-[340px]"
      :style="{ backgroundColor: color.hsl }"
    >
      <div
        class="absolute inset-0 bg-linear-to-b"
        :class="[
          'dark:from-black/10 dark:to-black/60',
          'from-white/70 to-transparent'
        ]"
      />
      <div class="relative flex items-end gap-6">
        <HeroImage
          :src="data.image"
          :alt="data.title"
          :rounded="isArtist(data)"
          :editable="isPlaylist(data) && data.isOwner"
          @edit="handleEditImage"
        />
        <div class="text-white">
          <div class="text-xs font-medium opacity-90">
            {{ typeLabel }}
          </div>
          <h1
            class="font-black leading-tight mt-2 text-[6rem]"
          >
            {{ data.title }}
          </h1>
          <HeroMeta
            :data="data"
            class="mt-4"
          />
        </div>
      </div>
    </div>
  </MediaContextMenu>
</template>
<script setup lang="ts">
import MediaContextMenu from "@/components/media-hero/context-menu/MediaContextMenu.vue";
import { isArtist, isPlaylist, MediaData } from "./types";
import { useImageColor } from "@/composables/useImageColor";
import { computed, onBeforeMount } from "vue";
import { useI18n } from "vue-i18n";
import HeroImage from "./HeroImage.vue";
import HeroMeta from "./HeroMeta.vue";

const props = defineProps<{
  data: MediaData;
}>();
const emit = defineEmits<{
  editImage: [];
}>();

const { t } = useI18n();

const { color, extractColor } = useImageColor({
  colorType: "Muted",
  lightness: 38,
  saturation: 47,
});

onBeforeMount(() => {
  extractColor(props.data.image);
});

const contextType = computed(() => {
  switch (props.data.type) {
    case "artist":
      return "artist-page";
    case "liked":
      return "liked";
    case "playlist":
      return "playlist";
    case "album":
      return "album";
    default:
      return "album";
  }
});
const typeLabel = computed(() => {
  switch (props.data.type) {
    case "playlist": return t("media.type.playlist");
    case "artist": return t("media.type.artist");
    case "album": return t("media.type.album");
    case "liked": return t("media.type.playlist");
    default:
      return t("media.type.album");
  }
});

const handleEditImage = () => {
  emit("editImage");
};

</script>
