<template>
  <ResponsiveMenuItem @select="props.onTogglePin">
    <IconPinFilled
      v-if="item.isPinned"
      class="size-5  text-primary"
    />
    <IconPin
      v-else
      class="size-5 "
    />
    {{ item.isPinned ? 'Unpin playlist' : 'Pin playlist' }}
  </ResponsiveMenuItem>

  <ResponsiveMenuItem
    variant="destructive"
    @select="props.onDelete"
  >
    <IconTrash class="size-5 " />
    Delete playlist
  </ResponsiveMenuItem>
</template>
<script setup lang="ts">
import {
  ResponsiveMenuItem,
} from "@/components/ui/responsive-menu";
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
