<template>
  <ContextMenuItem @select="props.onTogglePin">
    <IconPinFilled
      v-if="item.isPinned"
      class="size-5  text-primary"
    />
    <IconPin
      v-else
      class="size-5 "
    />
    {{ item.isPinned ? 'Unpin album' : 'Pin album' }}
  </ContextMenuItem>

  <ContextMenuItem
    class="text-destructive focus:text-destructive"
    @select="props.onDelete"
  >
    <IconTrash class="size-5 " />
    Delete album
  </ContextMenuItem>
</template>

<script setup lang="ts">
import {
  ContextMenuItem,
} from "@/components/ui/context-menu";
import type { LibraryItem } from "@/modules/library/types";
import IconPinFilled from "~icons/tabler/pin-filled";
import IconPin from "~icons/tabler/pin";
import IconTrash from "~icons/tabler/trash";

const props = defineProps<{
  item: LibraryItem;
  onTogglePin: () => void;
  onDelete: () => void;
}>();
</script>
