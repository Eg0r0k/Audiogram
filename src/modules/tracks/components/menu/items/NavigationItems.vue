<template>
  <component
    :is="Item"
    @click="emit('goToArtist')"
  >
    <IconUser
      class="size-5.5"
    />
    {{ $t('track.contextMenu.goToArtist') }}
  </component>
  <component
    :is="Item"
    @click="emit('goToAlbum')"
  >
    <IconDisc
      class="size-5.5"
    />
    {{ $t('track.contextMenu.goToAlbum') }}
  </component>
</template>

<script setup lang="ts">
import { useTrackMenuComponents } from "../useTrackMenuComponents";
import IconDisc from "~icons/tabler/disc";
import IconUser from "~icons/tabler/user";

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
