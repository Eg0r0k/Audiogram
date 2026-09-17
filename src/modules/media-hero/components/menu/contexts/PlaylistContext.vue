<template>
  <component
    :is="Item"
    @click="actions.addToQueue"
  >
    <IconPlaylistAdd class="size-5.5" />
    {{ $t('common.addToQueue') }}
  </component>

  <component
    :is="Item"
    v-if="actions.canDownloadOffline?.value"
    @click="actions.downloadOffline?.()"
  >
    <IconDownload class="size-5.5" />
    {{ $t('media.contextMenu.downloadPlaylist') }}
  </component>

  <template v-if="canEdit || canDelete">
    <component :is="Separator" />

    <component
      :is="Item"
      v-if="canEdit"
      @click="actions.edit"
    >
      <IconPencil class="size-5.5" />
      {{ $t('common.edit') }}
    </component>

    <component
      :is="Item"
      v-if="canDelete"
      variant="destructive"
      @click="actions.delete"
    >
      <IconTrash class="size-5.5" />
      {{ $t('common.delete') }}
    </component>
  </template>
</template>

<script setup lang="ts">
import { computed } from "vue";
import IconDownload from "~icons/tabler/download";
import IconPencil from "~icons/tabler/pencil";
import IconTrash from "~icons/tabler/trash";
import IconPlaylistAdd from "~icons/tabler/playlist-add";
import { useMenuComponents } from "@/modules/media-hero/composables/useMenuComponents";
import type { MediaActions } from "../types";

const props = defineProps<{
  actions: MediaActions;
  isOwner?: boolean;
}>();

const { Item, Separator } = useMenuComponents();

// Edit needs a Dexie row; delete also works for an own catalog playlist
// whose source deletes it.
const canManage = computed(() => props.actions.canManage?.value ?? true);
const canEdit = computed(() => !!props.isOwner && canManage.value);
const canDelete = computed(() => !!props.isOwner && (canManage.value || (props.actions.canDeleteAtSource?.value ?? false)));
</script>
