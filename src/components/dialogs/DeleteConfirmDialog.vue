<template>
  <Dialog
    :open="isOpen"
    @update:open="handleOpenChange"
  >
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ dialogTitle }}</DialogTitle>
        <DialogDescription>
          {{ dialogDescription }}
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="deleteData"
        class="flex items-start gap-4 overflow-hidden"
      >
        <div
          class="size-16 shrink-0 overflow-hidden bg-muted"
          :class="coverShapeClass"
        >
          <img
            v-if="coverUrl"
            :src="coverUrl"
            :alt="deleteData.name"
            class="size-full object-cover"
          >
          <div
            v-else
            class="flex size-full items-center justify-center"
          >
            <component
              :is="fallbackIcon"
              class="size-6 text-muted-foreground"
            />
          </div>
        </div>

        <div class="min-w-0 flex-1 overflow-hidden">
          <p class="w-full truncate font-medium">
            {{ deleteData.name }}
          </p>
          <p class="text-sm text-muted-foreground">
            {{ $t("common.trackCount", deleteData.trackCount) }}
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="ghost-primary"
          @click="closeDeleteDialog"
        >
          {{ $t("common.cancel") }}
        </Button>
        <Button
          variant="destructive-link"
          @click="handleConfirm"
        >
          {{ $t("common.delete") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDeleteConfirmDialog } from "@/composables/useDeleteConfirmDialog";
import { useEntityCover } from "@/modules/covers/composables/useEntityCover";

import IconPlaylist from "~icons/tabler/playlist";
import IconDisc from "~icons/tabler/disc";
import IconUser from "~icons/tabler/user";

const { t } = useI18n();
const {
  isOpen,
  deleteData,
  closeDeleteDialog,
  handleConfirm,
} = useDeleteConfirmDialog();

const ownerType = computed(() => deleteData.value?.type ?? null);
const ownerId = computed(() => deleteData.value?.id ?? null);

const { url: coverUrl } = useEntityCover(ownerType, ownerId);

const dialogTitle = computed(() => {
  switch (deleteData.value?.type) {
    case "album":
      return t("library.contextMenu.deleteAlbum");
    case "playlist":
      return t("library.contextMenu.deletePlaylist");
    case "artist":
      return t("dialogs.deleteArtist.title");
    default:
      return t("common.delete");
  }
});

const dialogDescription = computed(() => {
  if (!deleteData.value) {
    return "";
  }

  return t("dialogs.deleteConfirm.description", {
    name: deleteData.value.name,
  });
});

const coverShapeClass = computed(() =>
  deleteData.value?.type === "artist" ? "rounded-full" : "rounded-lg",
);

const fallbackIcon = computed(() => {
  switch (deleteData.value?.type) {
    case "album":
      return IconDisc;
    case "artist":
      return IconUser;
    case "playlist":
    default:
      return IconPlaylist;
  }
});

function handleOpenChange(open: boolean) {
  if (!open) {
    closeDeleteDialog();
  }
}
</script>
