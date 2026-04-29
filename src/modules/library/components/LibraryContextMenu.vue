<template>
  <ContextMenu v-model:open="isContextMenuOpen">
    <div
      ref="guardRef"
      class="contents"
    >
      <ContextMenuTrigger as-child>
        <slot />
      </ContextMenuTrigger>
    </div>

    <ContextMenuContent
      class="w-50 bg-popover/50 backdrop-blur-[50px]"
    >
      <template v-if="activeItem">
        <component
          :is="contextComponent"
          v-bind="contextProps"
        />
      </template>
    </ContextMenuContent>
  </ContextMenu>
</template>

<script setup lang="ts">
import { computed, type Component, useTemplateRef } from "vue";
import { useEventListener } from "@vueuse/core";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useLibraryMenu } from "@/modules/library/composables/useLibraryMenu";
import { useLibrary } from "@/modules/library/composables/useLibrary";
import type { LibraryItem } from "@/modules/library/types";
import ArtistContext from "./contexts/ArtistContext.vue";
import DefaultContext from "./contexts/DefaultContext.vue";
import FavoriteContext from "./contexts/FavoriteContext.vue";
import { useLibraryContextActions } from "../composables/useLibraryContextActions";

const { activeItem, isContextMenuOpen } = useLibraryMenu();
const { togglePin, createPlaylist } = useLibrary();
const { addToQueue } = useLibraryContextActions();

const contexts: Record<LibraryItem["type"], Component> = {
  artist: ArtistContext,
  album: DefaultContext,
  playlist: DefaultContext,
  liked: FavoriteContext,
  allMedia: FavoriteContext,
};

const contextComponent = computed(() =>
  activeItem.value ? contexts[activeItem.value.type] : null,
);

const contextProps = computed(() => {
  if (!activeItem.value) {
    return {};
  }

  switch (activeItem.value.type) {
    case "artist":
      return {
        item: activeItem.value,
        onTogglePin: handleTogglePin,
        onDelete: handleDelete,
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
        deleteItem: handleDelete,
      };
  }
});

const guardRef = useTemplateRef<HTMLElement>("guardRef");

useEventListener(guardRef, "contextmenu", (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (!target.closest("[data-library-item]")) {
    e.preventDefault();
    e.stopPropagation();
  }
}, { capture: true });

const handleTogglePin = () => {
  if (!activeItem.value || activeItem.value.type === "liked" || activeItem.value.type === "allMedia") return;
  togglePin(activeItem.value.type, activeItem.value.id);
};

const handleAddToQueue = async () => {
  if (!activeItem.value || activeItem.value.type === "artist") return;
  await addToQueue(activeItem.value);
};

const handleCreatePlaylist = async () => {
  await createPlaylist();
};

const emit = defineEmits<{
  delete: [item: LibraryItem];
}>();

const handleDelete = () => {
  if (!activeItem.value || activeItem.value.type === "liked" || activeItem.value.type === "allMedia") return;
  emit("delete", activeItem.value);
};
</script>
