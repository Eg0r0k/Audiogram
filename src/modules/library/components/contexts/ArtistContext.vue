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
    {{ item.isPinned ? $t("artist.unpinArtist") : $t("artist.pinArtist") }}
  </ResponsiveMenuItem>

  <ResponsiveMenuItem
    v-if="props.onMoveToFolder"
    @select="props.onMoveToFolder"
  >
    <IconFolder class="size-5" />
    {{ $t("library.folder.moveToFolder") }}
  </ResponsiveMenuItem>

  <ResponsiveMenuItem
    v-if="props.onRemoveFromFolder"
    @select="props.onRemoveFromFolder"
  >
    <IconFolderMinus class="size-5" />
    {{ $t("library.folder.removeFromFolder") }}
  </ResponsiveMenuItem>

  <ResponsiveMenuItem
    variant="destructive"
    @select="props.onDelete"
  >
    <IconTrash class="size-5 " />
    {{ $t("artist.deleteArtist") }}
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
import IconFolder from "~icons/tabler/folder";
import IconFolderMinus from "~icons/tabler/folder-minus";

const props = defineProps<{
  item: LibraryItem;
  onTogglePin: () => void;
  onMoveToFolder?: () => void;
  onRemoveFromFolder?: () => void;
  onDelete: () => void;
}>();
</script>
