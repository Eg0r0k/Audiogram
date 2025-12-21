<template>
  <ShareItem @share="actions.share" />
</template>

<script setup lang="ts">
import ShareItem from "@/components/media-hero/menu/items/ShareItem.vue";
import type { MediaActions } from "../types";

defineProps<{
  actions: MediaActions;
}>();
</script>
