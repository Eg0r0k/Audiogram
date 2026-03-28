<template>
  <DefaultContext
    :item="item"
    :add-to-queue="addToQueue"
    :create-playlist="createPlaylist"
  />
</template>

<script setup lang="ts">
import type { LibraryItem } from "@/modules/library/types";
import DefaultContext from "./DefaultContext.vue";

defineProps<{
  item: LibraryItem;
  addToQueue: () => void;
  createPlaylist: () => void;
}>();
</script>
