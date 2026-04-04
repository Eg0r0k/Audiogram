<template>
  <component
    :is="Item"
    @click="emit('download')"
  >
    <IconDownload class="size-5.5" />
    {{ $t("track.contextMenu.download") }}
  </component>
</template>

<script setup lang="ts">
import IconDownload from "~icons/tabler/download";
import { useTrackMenuComponents } from "../useTrackMenuComponents";

const { Item } = useTrackMenuComponents();

const emit = defineEmits<{
  download: [];
}>();
</script>
