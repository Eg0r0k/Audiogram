<template>
  <component
    :is="Item"
    @click="emit('changeAlbum')"
  >
    <Icon
      class=" size-5.5"
      icon="tabler:pencil"
    />
    {{ $t('common.edit') }}
  </component>
  <component
    :is="Item"
    @click="emit('deleteAlbum')"
  >
    <Icon
      class=" size-5.5"
      icon="tabler:circle-minus"
    />
    {{ $t('common.delete') }}
  </component>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { useMenuComponents } from "@/components/media-hero/useMenuComponents";

const { Item } = useMenuComponents();

const emit = defineEmits<{
  changeAlbum: [];
  deleteAlbum: [];
}>();
</script>
