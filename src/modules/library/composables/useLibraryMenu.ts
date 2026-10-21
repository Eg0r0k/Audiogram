import { inject, provide, ref, shallowRef, type InjectionKey, type Ref, type ShallowRef } from "vue";
import type { LibraryItem } from "@/modules/library/types";
import { getAlbumLibraryRow } from "@/queries/album.queries";
import { getArtistLibraryRow } from "@/queries/artist.queries";
import { getPlaylistLibraryRow } from "@/queries/playlist.queries";
import { getLogger } from "@/lib/logger";
import { sourceKindOf } from "@/modules/sources/lib/display";
import type { AlbumId, ArtistId, PlaylistId } from "@/types/ids";

/**
 * Which action set the open menu serves: a Dexie-backed library row, or a
 * live catalog row (ND browsing) that only supports source actions.
 */
export type LibraryMenuFlavor = "library" | "catalog";

/** What a row gets from the LibraryContextMenu it sits in. */
export interface LibraryMenuHandle {
  /**
   * Asks for the menu on `event`. The event is taken at once (default
   * prevented, propagation stopped) even when the row turns out to have no
   * menu; the open itself may follow a Dexie lookup.
   */
  openMenu: (item: LibraryItem, event: Event) => void;
  /** Whether the menu is up for exactly this row. */
  isMenuOpenFor: (item: Pick<LibraryItem, "id" | "type">) => boolean;
}

export interface LibraryMenu extends LibraryMenuHandle {
  activeItem: ShallowRef<LibraryItem | null>;
  menuFlavor: Ref<LibraryMenuFlavor>;
  /** The shell's open state; the shell writes it through v-model, rows read it. */
  isOpen: Ref<boolean>;
}

const LibraryMenuKey: InjectionKey<LibraryMenuHandle> = Symbol("LibraryMenu");

/** A row outside any shell has no menu; its right-click stays the browser's. */
const noMenu: LibraryMenuHandle = {
  openMenu: () => undefined,
  isMenuOpenFor: () => false,
};

/** Whether the item is backed by a real library row (shadow rows included). */
const hasLibraryRow = async (item: LibraryItem): Promise<boolean> => {
  switch (item.type) {
    case "album":
      return (await getAlbumLibraryRow(item.id as AlbumId)) !== null;
    case "artist":
      return (await getArtistLibraryRow(item.id as ArtistId)) !== null;
    case "playlist":
      return (await getPlaylistLibraryRow(item.id as PlaylistId)) !== null;
    default:
      return true;
  }
};

/** Catalog rows with something actionable; the rest never open a menu. */
const hasCatalogMenu = (item: LibraryItem): boolean => item.type === "album" || item.type === "playlist";

/**
 * One menu state per LibraryContextMenu. `show` places the shell's menu at
 * the event once the row is known to have one.
 */
export const createLibraryMenu = (show: (event: Event) => void): LibraryMenu => {
  const activeItem = shallowRef<LibraryItem | null>(null);
  const menuFlavor = ref<LibraryMenuFlavor>("library");
  const isOpen = ref(false);

  const open = (item: LibraryItem, flavor: LibraryMenuFlavor, event: Event) => {
    activeItem.value = item;
    menuFlavor.value = flavor;
    show(event);
  };

  const openMenu = (item: LibraryItem, event: Event) => {
    // Taken before deciding: the shadow-row check below is async, and by then
    // the event has reached the page's track menu, which would open on it.
    event.preventDefault();
    event.stopPropagation();

    if (item.isCatalog) {
      // Live catalog row: no DB lookup to make, only source actions apply.
      if (hasCatalogMenu(item)) open(item, "catalog", event);
      return;
    }

    if (sourceKindOf(item.id) === "local") {
      open(item, "library", event);
      return;
    }

    // Remote-prefixed id outside catalog browsing = a downloaded/pinned
    // SHADOW row: a library entity with the full action set (M5).
    hasLibraryRow(item).then(
      (exists) => {
        if (exists) open(item, "library", event);
      },
      (error: unknown) => {
        // Nothing opens; say why, otherwise a broken read looks exactly
        // like "this row is a catalog row".
        getLogger().error(`[Library] Menu lookup failed for ${item.type} ${item.id}: ${String(error)}`);
      },
    );
  };

  // The active row survives a close on purpose: the content must stay
  // rendered through the exit animation, and every open overwrites it.
  const isMenuOpenFor = (item: Pick<LibraryItem, "id" | "type">): boolean =>
    isOpen.value && activeItem.value?.id === item.id && activeItem.value.type === item.type;

  return { activeItem, menuFlavor, isOpen, openMenu, isMenuOpenFor };
};

export const provideLibraryMenu = (menu: LibraryMenuHandle): void => {
  provide(LibraryMenuKey, menu);
};

/** The enclosing shell's menu, or an inert one outside any shell. */
export const useLibraryMenu = (): LibraryMenuHandle => inject(LibraryMenuKey, noMenu);
