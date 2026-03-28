import { ref, watch } from "vue";
import type { LibraryItem } from "@/modules/library/types";

const activeItem = ref<LibraryItem | null>(null);
const isContextMenuOpen = ref(false);

watch(isContextMenuOpen, (isOpen) => {
  if (!isOpen) {
    activeItem.value = null;
  }
});

export function useLibraryMenu() {
  const openMenu = (item: LibraryItem) => {
    activeItem.value = item;
    isContextMenuOpen.value = true;
  };

  const closeMenu = () => {
    isContextMenuOpen.value = false;
  };

  return {
    activeItem,
    isContextMenuOpen,
    openMenu,
    closeMenu,
  };
}
