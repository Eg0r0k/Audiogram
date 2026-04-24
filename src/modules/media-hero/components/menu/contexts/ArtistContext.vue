<template>
  <component
    :is="Item"
    @click="actions.edit"
  >
    <IconPencil class="size-5.5" />
    {{ $t('common.edit') }}
  </component>

  <component :is="Separator" />

  <ShareItem @share="actions.share" />
</template>

<script setup lang="ts">
import IconPencil from "~icons/tabler/pencil";
import { useMenuComponents } from "@/modules/media-hero/composables/useMenuComponents";
import ShareItem from "../items/ShareItem.vue";
import type { MediaActions } from "../types";

defineProps<{
  actions: MediaActions;
}>();

const { Item, Separator } = useMenuComponents();
</script>
