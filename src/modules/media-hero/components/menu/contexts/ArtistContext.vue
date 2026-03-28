<template>
  <ShareItem @share="actions.share" />
</template>

<script setup lang="ts">
import ShareItem from "../items/ShareItem.vue";
import type { MediaActions } from "../types";

defineProps<{
  actions: MediaActions;
}>();
</script>
