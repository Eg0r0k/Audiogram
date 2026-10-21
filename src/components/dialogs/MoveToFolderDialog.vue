<template>
  <DialogContent class="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>{{ $t("library.folder.moveToFolder") }}</DialogTitle>
      <DialogDescription>
        {{ item.title }}
      </DialogDescription>
    </DialogHeader>

    <div class="flex flex-col gap-1">
      <Button
        v-for="folder in folders"
        :key="folder.id"
        type="button"
        variant="ghost"
        color="muted"
        class="justify-start"
        @click="close(folder.id)"
      >
        <IconFolder class="size-5" />
        {{ folder.name }}
      </Button>

      <Empty
        v-if="folders.length === 0"
      >
        <EmptyHeader>
          <EmptyMedia>
            <IconFolderOff class="size-11 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle>{{ $t("library.folder.noFolders") }}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    </div>
  </DialogContent>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogHeader, DialogTitle, useDialogContext } from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle, EmptyMedia } from "@/components/ui/empty";
import type { SidebarFolderEntity } from "@/db/entities";
import type { LibraryItem } from "@/modules/library/types";
import IconFolder from "~icons/tabler/folder";
import IconFolderOff from "~icons/tabler/folder-off";

defineProps<{
  item: LibraryItem;
  folders: SidebarFolderEntity[];
}>();

const { close } = useDialogContext<string>();
</script>
