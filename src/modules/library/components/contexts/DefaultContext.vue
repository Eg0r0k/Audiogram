<template>
  <ContextMenuItem
    v-if="canTogglePin"
    @select="props.togglePin"
  >
    <IconPinFilled
      v-if="item.isPinned"
      class="size-5 text-primary"
    />
    <IconPin
      v-else
      class="size-5"
    />
    {{ item.isPinned ? pinOffLabel : pinOnLabel }}
  </ContextMenuItem>

  <ContextMenuItem @select="props.addToQueue">
    <IconList class="size-5" />
    {{ $t("track.contextMenu.addToQueue") }}
  </ContextMenuItem>

  <ContextMenuItem @select="props.createPlaylist">
    <IconPlus class="size-5" />
    {{ $t("track.contextMenu.createPlaylist") }}
  </ContextMenuItem>

  <ContextMenuItem
    v-if="props.deleteItem"
    class="text-destructive focus:text-destructive"
    @select="props.deleteItem"
  >
    <IconTrash class="size-5" />
    {{ deleteLabel }}
  </ContextMenuItem>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ContextMenuItem } from "@/components/ui/context-menu";
import type { LibraryItem } from "@/modules/library/types";
import IconList from "~icons/tabler/list";
import IconPinFilled from "~icons/tabler/pin-filled";
import IconPin from "~icons/tabler/pin";
import IconPlus from "~icons/tabler/plus";
import IconTrash from "~icons/tabler/trash";

const props = defineProps<{
  item: LibraryItem;
  togglePin?: () => void;
  addToQueue: () => void;
  createPlaylist: () => void;
  deleteItem?: () => void;
}>();

const canTogglePin = computed(() => props.item.type !== "liked" && !!props.togglePin);

const pinOnLabel = computed(() => {
  switch (props.item.type) {
    case "album":
      return "Pin album";
    case "playlist":
      return "Pin playlist";
    default:
      return "Pin item";
  }
});

const pinOffLabel = computed(() => {
  switch (props.item.type) {
    case "album":
      return "Unpin album";
    case "playlist":
      return "Unpin playlist";
    default:
      return "Unpin item";
  }
});

const deleteLabel = computed(() => {
  switch (props.item.type) {
    case "album":
      return "Delete album";
    case "playlist":
      return "Delete playlist";
    default:
      return "Delete item";
  }
});
</script>
