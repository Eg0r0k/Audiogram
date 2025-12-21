<template>
  <component
    :is="Item"
    @click="emit('toggle')"
  >
    <Like
      :is-liked="isLiked"
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
import Like from "@/components/player/actions/Like.vue";
import { useTrackMenuComponents } from "../useTrackMenuComponents";

defineProps<{
  isLiked: boolean;
}>();

const { Item } = useTrackMenuComponents();

const emit = defineEmits<{
  toggle: [];
}>();
</script>
