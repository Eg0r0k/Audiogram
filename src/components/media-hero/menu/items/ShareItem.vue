<template>
  <component
    :is="Item"
    @click="emit('share')"
  >
    <IconShare2
      class=" size-5.5"
    />
    {{ $t('common.share') }}
  </component>
</template>

<script setup lang="ts">
import { useMenuComponents } from "@/components/media-hero/useMenuComponents";
import IconShare2 from "~icons/tabler/share-2";
const { Item } = useMenuComponents();

const emit = defineEmits<{
  share: [];
}>();
</script>
