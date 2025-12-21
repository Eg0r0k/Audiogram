<template>
  <AlbumItems
    @change-album="actions.changePlaylist"
    @delete-album="actions.deletePlaylist"
  />
  <MenuSeparator />
  <ShareItem @share="actions.share" />
</template>

<script setup lang="ts">
import AlbumItems from "@/components/media-hero/menu/items/AlbumItems.vue";
import MenuSeparator from "@/components/media-hero/menu/items/MenuSeparator.vue";
import ShareItem from "@/components/media-hero/menu/items/ShareItem.vue";
import type { MediaActions } from "../types";

defineProps<{
  actions: MediaActions;
}>();
</script>
