<template>
  <component
    :is="Item"
    @click="emit('toggle')"
  >
    <IconLike
      class=" size-5.5 "
    />
    {{
      !isLiked
        ? $t("track.contextMenu.addToFavorites")
        : $t("track.contextMenu.removeFromFavorites")
    }}
  </component>
</template>
<script setup lang="ts">
import IconLike from "~icons/tabler/heart";
import { useTrackMenuComponents } from "../useTrackMenuComponents";

defineProps<{
  isLiked: boolean;
}>();

const { Item } = useTrackMenuComponents();

const emit = defineEmits<{
  toggle: [];
}>();
</script>
