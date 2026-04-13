<template>
  <component
    :is="Item"
    @click="emit('show')"
  >
    <IconInfoCircle class="size-5.5" />
    {{ $t("track.contextMenu.details") }}
  </component>
</template>

<script setup lang="ts">
import IconInfoCircle from "~icons/tabler/info-circle";
import { useTrackMenuComponents } from "../useTrackMenuComponents";

const { Item } = useTrackMenuComponents();

const emit = defineEmits<{
  show: [];
}>();
</script>
