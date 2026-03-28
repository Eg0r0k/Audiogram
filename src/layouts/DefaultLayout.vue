<template>
  <div
    ref="dropZoneRef"
    class="app-grid  overflow-hidden h-dvh antialiased"
    :style="{
      paddingTop: top,
      paddingRight: right,
      paddingBottom: bottom,
      paddingLeft: left,
    }"
  >
    <WindowToolbar class="toolbar" />
    <DropOverlay :show="isDragging" />
    <ImportProgressSheet />
    <div class="content-area">
      <ResizableSidebar>
        <div class="relative flex-1 pt-4 h-full flex flex-col min-h-0 overflow-hidden">
          <SidebarHeader />
          <Scrollable
            direction="horizontal"
            hide-thumb
            class="shrink-0  border-b border-background "
          >
            <Tabs
              :model-value="activeFilter"
              @update:model-value="setFilter($event as LibraryFilter)"
            >
              <TabsList class="inline-flex items-center gap-0 px-4">
                <TabsTrigger
                  v-for="filter in LIBRARY_FILTERS"
                  :key="filter"
                  :value="filter"
                  class="text-base font-medium mb-0.5"
                >
                  {{ filterLabel(filter) }}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </Scrollable>
          <LibraryContextMenu @delete="handleDeleteItem">
            <div
              v-if="isLoading"
              class="flex-1 gap-2 flex flex-col p-2"
            >
              <div
                v-for="i in 20"
                :key="i"
                class="flex items-center gap-3 px-2"
              >
                <Skeleton class="size-[54px] rounded-full shrink-0" />
                <div class="flex flex-col gap-2 w-full">
                  <Skeleton class="h-3 w-[40%]" />
                  <Skeleton class="h-3 w-[65%]" />
                </div>
              </div>
            </div>

            <VirtualScrollable
              v-else
              :padding-top="8"
              :padding-bottom="8"
              :items="libraryItems"
              :item-height="72"
              class="flex-1"
            >
              <template #default="{ item }">
                <LibrarySidebarItem :item="item" />
              </template>
            </VirtualScrollable>
          </LibraryContextMenu>

          <FloatingButton />
          <SearchPanel />
        </div>
      </ResizableSidebar>

      <main
        class="main  "
      >
        <slot />
      </main>
    </div>

    <FooterMediaPlayer class="footer" />
  </div>
</template>

<script setup lang="ts">
import { useScreenSafeArea } from "@vueuse/core";
import WindowToolbar from "@/components/WindowToolbar.vue";
import FooterMediaPlayer from "@/components/layout/footer/FooterMediaPlayer.vue";
import ResizableSidebar from "@/components/layout/sidebar/ResizableSidebar.vue";
// import { computed } from "vue";
import { useFileDrop } from "@/composables/useFileDrop";
// import { useTheme } from "@/composables/useTheme";
// import { Moon, Sun } from "lucide-vue-next";

import SidebarHeader from "@/components/layout/sidebar/header/SidebarHeader.vue";
import FloatingButton from "@/components/layout/sidebar/floatingButton/FloatingButton.vue";
import DropOverlay from "@/components/DropOverlay.vue";
import { useImport } from "@/composables/useImport";
import ImportProgressSheet from "@/components/ImportProgressSheet.vue";
import SearchPanel from "@/components/layout/sidebar/SearchPanel.vue";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import VirtualScrollable from "@/components/ui/scrollable/VirtualScrollable.vue";
import { computed } from "vue";
import { useLibrary } from "@/modules/library/composables/useLibrary";
import LibrarySidebarItem from "@/components/layout/sidebar/LibrarySidebarItem.vue";
import Skeleton from "@/components/ui/skeleton/Skeleton.vue";
import LibraryContextMenu from "@/modules/library/components/LibraryContextMenu.vue";
import { albumRepository, artistRepository } from "@/db/repositories";
import { playlistRepository } from "@/db/repositories/playlist.repository";
import { AlbumId, ArtistId, PlaylistId } from "@/types/ids";
import { LIBRARY_FILTERS, LibraryFilter, LibraryItem } from "@/modules/library/types";
import { useI18n } from "vue-i18n";
import { Scrollable } from "@/components/ui/scrollable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const {
  pinnedItems,
  unpinnedItems,
  isLoading,
  activeFilter,
  setFilter,
  invalidateLibrary,
} = useLibrary();

const handleDeleteItem = async (item: LibraryItem) => {
  switch (item.type) {
    case "artist":
      await artistRepository.delete(item.id as ArtistId);
      break;
    case "album":
      await albumRepository.delete(item.id as AlbumId);
      break;
    case "playlist":
      await playlistRepository.delete(item.id as PlaylistId);
      break;
  }
  await invalidateLibrary();
};

const { t } = useI18n();

const filterLabels = computed<Record<LibraryFilter, string>>(() => ({
  all: t("library.filterAll"),
  playlist: t("library.filterPlaylists"),
  artist: t("library.filterArtists"),
  album: t("library.filterAlbums"),
}));

function filterLabel(value: LibraryFilter) {
  return filterLabels.value[value] ?? value;
}

const libraryItems = computed(() => [
  ...pinnedItems.value,
  ...unpinnedItems.value,
]);
const { importFiles } = useImport();

const { isDragging } = useFileDrop({
  acceptedExtensions: [".mp3", ".flac", ".wav", ".ogg", ".m4a", ".aac", ".opus"],
  onDrop: (files) => {
    importFiles(files);
  },
});

const { top, right, bottom, left } = useScreenSafeArea();
// const swipeContainer = ref<HTMLElement | null>(null);
// const TABS = ["music", "podcasts", "audiobooks"];
// const currentTab = ref("music");
// const nextTab = () => {
//   const currentIndex = TABS.indexOf(currentTab.value);
//   if (currentIndex < TABS.length - 1) {
//     currentTab.value = TABS[currentIndex + 1];
//   } else {
//     currentTab.value = TABS[0];
//   }
// };

// const prevTab = () => {
//   const currentIndex = TABS.indexOf(currentTab.value);
//   if (currentIndex > 0) {
//     currentTab.value = TABS[currentIndex - 1];
//   } else {
//     currentTab.value = TABS[TABS.length - 1];
//   }
// };

// useSwipeControl(swipeContainer, {
//   threshold: 70,
//   onSwipeLeft: nextTab,
//   onSwipeRight: prevTab,
// });
</script>

<style scoped>
.app-grid {
  display: grid;
  grid-template-areas:
    "toolbar"
    "header"
    "content"
    "footer";
  grid-template-rows: auto auto 1fr auto;
}

.toolbar {
  grid-area: toolbar;
}

.header {
  grid-area: header;
}

.content-area {
  grid-area: content;
  display: flex;
  overflow: hidden;
}

.main {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 0;
}

.footer {
  grid-area: footer;
}
</style>
