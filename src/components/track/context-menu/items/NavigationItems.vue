<template>
  <ContextMenuItem @click="emit('goToArtist')">
    <Icon icon="tabler:user" />
    {{ $t('track.contextMenu.goToArtist') }}
  </ContextMenuItem>
  <ContextMenuItem @click="emit('goToAlbum')">
    <Icon icon="tabler:disc" />
    {{ $t('track.contextMenu.goToAlbum') }}
  </ContextMenuItem>
</template>

<script setup lang="ts">
import { ContextMenuItem } from "@/components/ui/context-menu";
import { Icon } from "@iconify/vue";

defineOptions({
  inheritAttrs: false,
});

defineProps<{
  artistName: string;
  albumName: string;
}>();

const emit = defineEmits<{
  goToArtist: [];
  goToAlbum: [];
}>();
</script>
