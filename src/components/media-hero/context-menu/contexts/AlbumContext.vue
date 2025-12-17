<template>
  <AlbumItems
    @change-album="actions.changePlaylist"
    @delete-album="actions.deletePlaylist"
  />
  <MenuSeparator />
  <ShareItem @share="actions.share" />
</template>

<script setup lang="ts">
import AlbumItems from "@/components/media-hero/items/AlbumItems.vue";
import MenuSeparator from "@/components/media-hero/items/MenuSeparator.vue";
import ShareItem from "@/components/media-hero/items/ShareItem.vue";
import type { MediaActions } from "../types";

defineProps<{
  actions: MediaActions;
}>();
</script>
