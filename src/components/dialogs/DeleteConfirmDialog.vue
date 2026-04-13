<template>
  <Dialog
    :open="isOpen"
    @update:open="handleOpenChange"
  >
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ $t(titleKey) }}</DialogTitle>
      </DialogHeader>

      <div class="flex items-start gap-4 overflow-hidden">
        <div class="size-16 rounded-lg bg-muted overflow-hidden shrink-0">
          <img
            v-if="coverUrl"
            :src="coverUrl"
            :alt="deleteData?.name"
            class="size-full object-cover"
          >
          <div
            v-else
            class="size-full flex items-center justify-center"
          >
            <component
              :is="iconComponent"
              class="size-6 text-muted-foreground"
            />
          </div>
        </div>

        <div class="flex-1 min-w-0 overflow-hidden">
          <p class="font-medium truncate w-full">
            {{ deleteData?.name }}
          </p>
          <p class="text-sm text-muted-foreground">
            {{ $t("common.trackCount", deleteData?.trackCount ?? 0) }}
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="destructive-link"
          :disabled="isDeleting"
          @click="closeDeleteDialog"
        >
          {{ $t("common.cancel") }}
        </Button>
        <Button
          variant="link"
          :disabled="isDeleting"
          @click="handleConfirm"
        >
          {{ $t("common.delete") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDeleteConfirmDialog } from "@/composables/useDeleteConfirmDialog";
import IconPlaylist from "~icons/tabler/playlist";
import IconAlbum from "~icons/tabler/album";
import IconUser from "~icons/tabler/user";

const { isOpen, deleteData, closeDeleteDialog, handleConfirm: confirmHandler } = useDeleteConfirmDialog();

const isDeleting = ref(false);
const coverUrl = ref<string | null>(null);

const titleKey = computed(() => {
  const type = deleteData.value?.type;
  if (type === "playlist") return "dialogs.deletePlaylist.title";
  if (type === "album") return "dialogs.deleteAlbum.title";
  if (type === "artist") return "dialogs.deleteArtist.title";
  return "dialogs.delete.title";
});

const iconComponent = computed(() => {
  const type = deleteData.value?.type;
  if (type === "playlist") return IconPlaylist;
  if (type === "album") return IconAlbum;
  if (type === "artist") return IconUser;
  return IconPlaylist;
});

function handleOpenChange(open: boolean) {
  if (!open) {
    closeDeleteDialog();
  }
}

function handleConfirm() {
  isDeleting.value = true;
  confirmHandler();
}
</script>
