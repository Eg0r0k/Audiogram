<template>
  <component
    :is="Item"
    @click="emit('play')"
  >
    <Icon
      icon="tabler:player-play-filled"
      class="size-5"
    />
    {{ $t('track.contextMenu.play') }}
  </component>

  <component
    :is="Item"
    @click="emit('playNext')"
  >
    <Icon
      icon="tabler:playlist-add"
      class="size-5.5"
    />
    {{ $t('track.contextMenu.playNext') }}
  </component>

  <component
    :is="Item"
    @click="emit('addToQueue')"
  >
    <Icon
      icon="tabler:list-numbers"
      class="size-5.5"
    />
    {{ $t('track.contextMenu.addToQueue') }}
  </component>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { useTrackMenuComponents } from "../useTrackMenuComponents";

defineOptions({
  inheritAttrs: false,
});
const { Item } = useTrackMenuComponents();

const emit = defineEmits<{
  play: [];
  playNext: [];
  addToQueue: [];
}>();
</script>
