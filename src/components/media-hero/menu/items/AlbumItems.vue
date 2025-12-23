<template>
  <component
    :is="Item"
    @click="emit('changeAlbum')"
  >
    <IconPencil
      class=" size-5.5"
    />
    {{ $t('common.edit') }}
  </component>
  <component
    :is="Item"
    @click="emit('deleteAlbum')"
  >
    <IconCircleMinus
      class=" size-5.5"
    />
    {{ $t('common.delete') }}
  </component>
</template>

<script setup lang="ts">
import { useMenuComponents } from "@/components/media-hero/useMenuComponents";
import IconCircleMinus from "~icons/tabler/circle-minus";
import IconPencil from "~icons/tabler/pencil";

const { Item } = useMenuComponents();

const emit = defineEmits<{
  changeAlbum: [];
  deleteAlbum: [];
}>();
</script>
