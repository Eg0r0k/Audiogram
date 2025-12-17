<template>
  <ShareItem @share="actions.share" />
</template>

<script setup lang="ts">
import ShareItem from "@/components/media-hero/items/ShareItem.vue";
import type { MediaActions } from "../types";

defineProps<{
  actions: MediaActions;
}>();
</script>
