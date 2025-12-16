<template>
  <ContextMenuItem @click="emit('play')">
    <Icon icon="tabler:player-play" />
    {{ $t('track.contextMenu.play') }}
  </ContextMenuItem>

  <ContextMenuItem @click="emit('playNext')">
    <Icon icon="tabler:playlist-add" />
    {{ $t('track.contextMenu.playNext') }}
  </ContextMenuItem>

  <ContextMenuItem @click="emit('addToQueue')">
    <Icon icon="tabler:list-numbers" />
    {{ $t('track.contextMenu.addToQueue') }}
  </ContextMenuItem>
</template>

<script setup lang="ts">
import { ContextMenuItem } from "@/components/ui/context-menu";
import { Icon } from "@iconify/vue";

defineOptions({
  inheritAttrs: false,
});

const emit = defineEmits<{
  play: [];
  playNext: [];
  addToQueue: [];
}>();
</script>
