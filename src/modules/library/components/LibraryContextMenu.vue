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
      class="w-44 bg-popover/50 backdrop-blur-[50px]"
    >
      <template v-if="activeItem">
        <component
          :is="contextComponent"
          :item="activeItem"
          :on-toggle-pin="handleTogglePin"
          :on-delete="handleDelete"
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
import AlbumContext from "./contexts/AlbumContext.vue";
import PlaylistContext from "./contexts/PlaylistContext.vue";

const { activeItem, isContextMenuOpen } = useLibraryMenu();
const { togglePin } = useLibrary();

const contexts: Record<LibraryItem["type"], Component> = {
  artist: ArtistContext,
  album: AlbumContext,
  playlist: PlaylistContext,
};

const contextComponent = computed(() =>
  activeItem.value ? contexts[activeItem.value.type] : null,
);

const guardRef = useTemplateRef<HTMLElement>("guardRef");

useEventListener(guardRef, "contextmenu", (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (!target.closest("[data-library-item]")) {
    e.preventDefault();
    e.stopPropagation();
  }
}, { capture: true });

const handleTogglePin = () => {
  if (!activeItem.value) return;
  togglePin(activeItem.value.type, activeItem.value.id);
};

const emit = defineEmits<{
  delete: [item: LibraryItem];
}>();

const handleDelete = () => {
  if (!activeItem.value) return;
  emit("delete", activeItem.value);
};
</script>
