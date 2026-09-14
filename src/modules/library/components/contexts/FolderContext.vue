<template>
  <ResponsiveMenuItem @select="props.openFolder">
    <IconFolderOpen class="size-5" />
    {{ $t("library.folder.open") }}
  </ResponsiveMenuItem>

  <ResponsiveMenuItem @select="props.addToFolder">
    <IconFolderPlus class="size-5" />
    {{ $t("library.folder.addItems") }}
  </ResponsiveMenuItem>

  <ResponsiveMenuItem @select="props.renameFolder">
    <IconPencil class="size-5" />
    {{ $t("library.folder.rename") }}
  </ResponsiveMenuItem>

  <ResponsiveMenuItem
    variant="destructive"
    @select="props.deleteFolder"
  >
    <IconTrash class="size-5" />
    {{ $t("library.folder.delete") }}
  </ResponsiveMenuItem>
</template>

<script setup lang="ts">
import { ResponsiveMenuItem } from "@/components/ui/responsive-menu";
import IconFolderOpen from "~icons/tabler/folder-open";
import IconFolderPlus from "~icons/tabler/folder-plus";
import IconPencil from "~icons/tabler/pencil";
import IconTrash from "~icons/tabler/trash";

const props = defineProps<{
  openFolder: () => void;
  addToFolder: () => void;
  renameFolder: () => void;
  deleteFolder: () => void;
}>();
</script>
