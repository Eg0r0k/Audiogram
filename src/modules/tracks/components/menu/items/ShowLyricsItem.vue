<template>
  <component
    :is="Item"
    @click="emit('show')"
  >
    <IconFileText class="size-5.5" />
    {{ $t("track.contextMenu.showLyrics") }}
  </component>
</template>

<script setup lang="ts">
import IconFileText from "~icons/tabler/file-text";
import { useTrackMenuComponents } from "../useTrackMenuComponents";

const { Item } = useTrackMenuComponents();

const emit = defineEmits<{
  show: [];
}>();
</script>
