<template>
  <component
    :is="Item"
    @click="actions.edit"
  >
    <IconPencil
      class=" size-5.5"
    />
    {{ $t('common.edit') }}
  </component>

  <component
    :is="Item"
    variant="destructive"
    @click="actions.delete"
  >
    <IconTrash
      class=" size-5.5"
    />
    {{ $t('common.delete') }}
  </component>

  <component :is="Separator" />

  <ShareItem @share="actions.share" />
</template>

<script setup lang="ts">
import type { MediaActions } from "../types";
import IconPencil from "~icons/tabler/pencil";
import IconTrash from "~icons/tabler/trash";
import { useMenuComponents } from "../../useMenuComponents";
import ShareItem from "../items/ShareItem.vue";

defineProps<{
  actions: MediaActions;
}>();

const { Item, Separator } = useMenuComponents();
</script>
