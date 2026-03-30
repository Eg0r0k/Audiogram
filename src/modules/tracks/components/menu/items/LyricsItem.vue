<template>
  <component
    :is="Item"
    @click="emit('attach')"
  >
    <IconFileMusic class="size-5.5" />
    {{ hasLyrics ? $t("track.contextMenu.replaceLyrics") : $t("track.contextMenu.addLyrics") }}
  </component>
</template>

<script setup lang="ts">
import IconFileMusic from "~icons/tabler/file-music";
import { useTrackMenuComponents } from "../useTrackMenuComponents";

defineProps<{
  hasLyrics: boolean;
}>();

const { Item } = useTrackMenuComponents();

const emit = defineEmits<{
  attach: [];
}>();
</script>
