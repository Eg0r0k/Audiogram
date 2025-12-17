<template>
  <ContextMenuItem @click="emit('toggle')">
    <Like
      :is-liked="isLiked"
      class=" size-5.5 "
    />
    {{
      !isLiked
        ? $t("track.contextMenu.addToFavorites")
        : $t("track.contextMenu.removeFromFavorites")
    }}
  </ContextMenuItem>
</template>
<script setup lang="ts">
import Like from "@/components/player/actions/Like.vue";
import ContextMenuItem from "@/components/ui/context-menu/ContextMenuItem.vue";

defineProps<{
  isLiked: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();
</script>
