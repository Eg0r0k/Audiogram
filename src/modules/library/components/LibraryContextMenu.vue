<template>
  <ResponsiveContextMenu
    ref="menu"
    v-model:open="isOpen"
  >
    <slot />

    <ResponsiveMenuContent
      class="w-50 bg-popover/50 backdrop-blur-[50px]"
    >
      <template v-if="activeItem">
        <component
          :is="contextComponent"
          v-bind="contextProps"
        />
      </template>
    </ResponsiveMenuContent>
  </ResponsiveContextMenu>
</template>

<script setup lang="ts">
import { computed, useTemplateRef, type Component } from "vue";
import {
  ResponsiveContextMenu,
  ResponsiveMenuContent,
} from "@/components/ui/responsive-menu";
import { createLibraryMenu, provideLibraryMenu } from "@/modules/library/composables/useLibraryMenu";
import { useLibrary } from "@/modules/library/composables/useLibrary";
import type { LibraryItem } from "@/modules/library/types";
import ArtistContext from "./contexts/ArtistContext.vue";
import CatalogContext from "./contexts/CatalogContext.vue";
import DefaultContext from "./contexts/DefaultContext.vue";
import FavoriteContext from "./contexts/FavoriteContext.vue";
import FolderContext from "./contexts/FolderContext.vue";
import { useLibraryContextActions } from "../composables/useLibraryContextActions";

const props = withDefaults(defineProps<{
  insideFolder?: boolean;
  folderActions?: boolean;
}>(), {
  insideFolder: false,
  folderActions: true,
});

const menu = useTemplateRef<InstanceType<typeof ResponsiveContextMenu>>("menu");

// Only rows in the slot open the menu, through the handle they inject.
const libraryMenu = createLibraryMenu(event => menu.value?.show(event));
provideLibraryMenu(libraryMenu);
const { activeItem, menuFlavor, isOpen } = libraryMenu;

const { togglePin, createPlaylist, moveToFolder } = useLibrary();
const { addToQueue, addCatalogToQueue, downloadCatalog } = useLibraryContextActions();

const contexts: Record<LibraryItem["type"], Component> = {
  artist: ArtistContext,
  album: DefaultContext,
  playlist: DefaultContext,
  liked: FavoriteContext,
  allMedia: FavoriteContext,
  folder: FolderContext,
  // Never shown: stations are catalog rows, and only albums and playlists
  // get a catalog menu (useLibraryMenu).
  radio: FavoriteContext,
};

const contextComponent = computed(() => {
  if (!activeItem.value) return null;
  // Catalog rows share one context: only source actions apply to them.
  if (menuFlavor.value === "catalog") return CatalogContext;
  return contexts[activeItem.value.type];
});

const contextProps = computed(() => {
  if (!activeItem.value) {
    return {};
  }

  if (menuFlavor.value === "catalog") {
    return {
      item: activeItem.value,
      addToQueue: handleCatalogAddToQueue,
      download: handleCatalogDownload,
    };
  }

  switch (activeItem.value.type) {
    case "artist":
      return {
        item: activeItem.value,
        onTogglePin: handleTogglePin,
        onMoveToFolder: props.folderActions ? handleMoveToFolder : undefined,
        onRemoveFromFolder: props.insideFolder ? handleRemoveFromFolder : undefined,
        onDelete: handleDelete,
      };
    case "folder":
      return {
        openFolder: handleOpenFolder,
        addToFolder: handleAddToFolder,
        renameFolder: handleRenameFolder,
        deleteFolder: handleDelete,
      };
    case "liked":
    case "allMedia":
      return {
        item: activeItem.value,
        addToQueue: handleAddToQueue,
        createPlaylist: handleCreatePlaylist,
      };
    default:
      return {
        item: activeItem.value,
        togglePin: handleTogglePin,
        addToQueue: handleAddToQueue,
        createPlaylist: handleCreatePlaylist,
        moveToFolder: props.folderActions ? handleMoveToFolder : undefined,
        removeFromFolder: props.insideFolder ? handleRemoveFromFolder : undefined,
        deleteItem: handleDelete,
      };
  }
});

const handleTogglePin = () => {
  if (!activeItem.value || activeItem.value.type === "liked" || activeItem.value.type === "allMedia" || activeItem.value.type === "folder" || activeItem.value.type === "radio") return;
  togglePin(activeItem.value.type, activeItem.value.id);
};

const handleAddToQueue = async () => {
  if (!activeItem.value || activeItem.value.type === "artist") return;
  await addToQueue(activeItem.value);
};

const handleCreatePlaylist = async () => {
  await createPlaylist();
};

const handleCatalogAddToQueue = async () => {
  if (!activeItem.value) return;
  await addCatalogToQueue(activeItem.value);
};

const handleCatalogDownload = async () => {
  if (!activeItem.value) return;
  await downloadCatalog(activeItem.value);
};

const emit = defineEmits<{
  delete: [item: LibraryItem];
  openFolder: [folderId: string];
  addToFolder: [folderId: string];
  renameFolder: [folderId: string];
  removeFromFolder: [item: LibraryItem];
}>();

const handleDelete = () => {
  if (!activeItem.value || activeItem.value.type === "liked" || activeItem.value.type === "allMedia") return;
  emit("delete", activeItem.value);
};

const handleOpenFolder = () => {
  if (!activeItem.value || activeItem.value.type !== "folder") return;
  emit("openFolder", activeItem.value.id);
};

const handleAddToFolder = () => {
  if (!activeItem.value || activeItem.value.type !== "folder") return;
  emit("addToFolder", activeItem.value.id);
};

const handleRenameFolder = () => {
  if (!activeItem.value || activeItem.value.type !== "folder") return;
  emit("renameFolder", activeItem.value.id);
};

const handleMoveToFolder = async () => {
  if (!activeItem.value) return;
  await moveToFolder(activeItem.value);
};

const handleRemoveFromFolder = () => {
  if (!activeItem.value || activeItem.value.type === "liked" || activeItem.value.type === "allMedia" || activeItem.value.type === "folder") return;
  emit("removeFromFolder", activeItem.value);
};
</script>
