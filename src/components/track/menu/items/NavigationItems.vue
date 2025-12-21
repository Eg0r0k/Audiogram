<template>
  <component
    :is="Item"
    @click="emit('goToArtist')"
  >
    <Icon
      icon="tabler:user"
      class="size-5.5"
    />
    {{ $t('track.contextMenu.goToArtist') }}
  </component>
  <component
    :is="Item"
    @click="emit('goToAlbum')"
  >
    <Icon
      icon="tabler:disc"
      class="size-5.5"
    />
    {{ $t('track.contextMenu.goToAlbum') }}
  </component>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { useTrackMenuComponents } from "../useTrackMenuComponents";

defineOptions({
  inheritAttrs: false,
});

defineProps<{
  artistName: string;
  albumName: string;
}>();

const { Item } = useTrackMenuComponents();

const emit = defineEmits<{
  goToArtist: [];
  goToAlbum: [];
}>();
</script>
