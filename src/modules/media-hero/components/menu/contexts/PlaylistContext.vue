<template>
  <component
    :is="Item"
    @click="actions.addToQueue"
  >
    <IconPlaylistAdd class="size-5.5" />
    {{ $t('common.addToQueue') }}
  </component>

  <component :is="Separator" />

  <template v-if="isOwner">
    <component
      :is="Item"
      @click="actions.edit"
    >
      <IconPencil class="size-5.5" />
      {{ $t('common.edit') }}
    </component>

    <component
      :is="Item"
      variant="destructive"
      @click="actions.delete"
    >
      <IconTrash class="size-5.5" />
      {{ $t('common.delete') }}
    </component>

    <component :is="Separator" />
  </template>

  <ShareItem @share="actions.share" />
</template>

<script setup lang="ts">
import IconPencil from "~icons/tabler/pencil";
import IconTrash from "~icons/tabler/trash";
import IconPlaylistAdd from "~icons/tabler/playlist-add";
import { useMenuComponents } from "@/modules/media-hero/composables/useMenuComponents";
import { MediaActions } from "../types";
import ShareItem from "../items/ShareItem.vue";

defineProps<{
  actions: MediaActions;
  isOwner?: boolean;
}>();

const { Item, Separator } = useMenuComponents();
</script>
