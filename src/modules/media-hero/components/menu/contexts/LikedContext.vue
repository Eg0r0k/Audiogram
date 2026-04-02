<template>
  <component
    :is="Item"
    @click="actions.addToQueue"
  >
    <IconPlaylistPlus class="size-5.5" />
    {{ $t("common.addToQueue") }}
  </component>
</template>

<script setup lang="ts">
import IconPlaylistPlus from "~icons/tabler/playlist-add";
import { useMenuComponents } from "@/modules/media-hero/composables/useMenuComponents";
import type { MediaActions } from "../types";

defineProps<{
  actions: MediaActions;
}>();

const { Item } = useMenuComponents();
</script>
