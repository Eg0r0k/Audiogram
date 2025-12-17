<template>
  <component
    :is="Item"
    @click="emit('share')"
  >
    <Icon
      class=" size-5.5"
      icon="tabler:share-2"
    />
    {{ $t('common.share') }}
  </component>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { useMenuComponents } from "../useMenuComponents";

const { Item } = useMenuComponents();

const emit = defineEmits<{
  share: [];
}>();
</script>
