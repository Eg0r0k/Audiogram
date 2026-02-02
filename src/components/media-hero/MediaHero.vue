<template>
  <MediaContextMenu :context="contextType">
    <div
      class="relative flex items-end px-6 pb-6 h-[32vh] min-h-[260px] max-h-[340px]"
      :style="{ background: `linear-gradient(${color.hsl} 0%, transparent 100%)` }"
    >
      <div
        class="relative flex   pt-6  max-h-[340px]"
      >
        <div class="relative flex gap-6">
          <MediaHeroImage
            :src="data.image"
            :alt="data.title"
            :rounded="isArtist(data)"
            :editable="isPlaylist(data) && data.isOwner"
            @edit="handleEditImage"
          />
          <div class=" text-foreground">
            <div class="text-xs font-medium opacity-90">
              {{ typeLabel }}
            </div>
            <h1
              class=" font-bold leading-tight mb-5 text-4xl"
            >
              {{ data.title }}
            </h1>
            <MediaHeroMeta
              :data="data"
            />
          </div>
        </div>
      </div>
    </div>
  </MediaContextMenu>
</template>
<script setup lang="ts">
import { isArtist, isPlaylist, MediaData } from "./types";
import { useImageColor } from "@/composables/useImageColor";
import { computed, onBeforeMount } from "vue";
import { useI18n } from "vue-i18n";
import MediaHeroImage from "./MediaHeroImage.vue";
import MediaContextMenu from "./menu/context-menu/MediaContextMenu.vue";
import MediaHeroMeta from "./MediaHeroMeta.vue";

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
