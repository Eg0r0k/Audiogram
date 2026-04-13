import { ref } from "vue";
import type { AlbumId, ArtistId, PlaylistId } from "@/types/ids";

export type DeleteConfirmType = "playlist" | "album" | "artist";

export interface DeleteConfirmData {
  type: DeleteConfirmType;
  id: PlaylistId | AlbumId | ArtistId;
  name: string;
  trackCount: number;
  coverPath?: string;
}

const isOpen = ref(false);
const deleteData = ref<DeleteConfirmData | null>(null);
const onConfirm = ref<(() => void) | null>(null);
let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

export function useDeleteConfirmDialog() {
  function openDeleteDialog(
    data: DeleteConfirmData,
    confirmCallback: () => void,
  ) {
    deleteData.value = data;
    onConfirm.value = confirmCallback;
    isOpen.value = true;
  }

  function closeDeleteDialog() {
    isOpen.value = false;
    cleanupTimer = setTimeout(() => {
      deleteData.value = null;
      onConfirm.value = null;
    }, 300);
  }

  function cancelCleanup() {
    if (cleanupTimer) {
      clearTimeout(cleanupTimer);
      cleanupTimer = null;
    }
  }

  function handleConfirm() {
    cancelCleanup();
    if (onConfirm.value) {
      onConfirm.value();
    }
    closeDeleteDialog();
  }

  return {
    isOpen,
    deleteData,
    openDeleteDialog,
    closeDeleteDialog,
    handleConfirm,
  };
}
