<template>
  <DefaultContext
    :track="track"
    :actions="actions"
  />
</template>

<script setup lang="ts">
import type { Track } from "@/modules/player/types";
import type { ContextActions } from "../type";
import DefaultContext from "./DefaultContext.vue";

defineProps<{
  track: Track;
  actions: ContextActions;
}>();
</script>
