<template>
  <div
    class="relative flex-1 pt-4 h-full flex flex-col min-h-0 overflow-hidden z-1"
  >
    <SidebarHeader :compact="isCompact" />

    <SlideTransition :depth="folderDepth">
      <div
        :key="transitionKey"
        class="flex-1 flex flex-col min-h-0 bg-card"
      >
        <template v-if="activeFolder">
          <LibrarySidebarFolderHeader
            :folder="activeFolder"
            :compact="isCompact"
            @close="closeFolder"
            @rename="renameActiveFolder"
          />
          <LibraryContextMenu
            inside-folder
            @delete="handleDeleteItem"
            @open-folder="openFolder"
            @add-to-folder="openFolderPicker"
            @rename-folder="openRenameFolderDialog"
            @remove-from-folder="removeItemFromActiveFolder"
          >
            <LibrarySidebarList
              class="flex-1 min-h-0"
              :items="getFolderItems(activeFolder.id)"
              :loading="isLoading"
              :loading-more="false"
              :compact="isCompact"
              :restore-key="`library-sidebar:folder:${activeFolder.id}`"
              @scroll="handleScroll"
              @open-folder="openFolder"
              @start-radio="startRadio"
            />
          </LibraryContextMenu>
        </template>

        <Tabs
          v-else
          :model-value="activeFilter"
          class="flex-1 min-h-0 gap-0"
          @update:model-value="setFilter($event as LibraryFilter)"
        >
          <Scrollable
            v-if="!isCompact"
            direction="horizontal"
            hide-thumb
            class="shrink-0 border-b dark:border-background border-border"
          >
            <TabsList
              variant="line"
              class="inline-flex items-center gap-0 px-2"
            >
              <TabsTrigger
                v-for="filter in visibleFilters"
                :key="filter"
                :value="filter"
                class="text-base font-medium mb-0.5"
              >
                {{ filterLabel(filter) }}
              </TabsTrigger>
            </TabsList>
          </Scrollable>

          <SourceHealthNotice
            :kind="catalogKind"
            class="mx-2 mt-2"
          />

          <LibraryContextMenu
            @delete="handleDeleteItem"
            @open-folder="openFolder"
            @add-to-folder="openFolderPicker"
            @rename-folder="openRenameFolderDialog"
            @remove-from-folder="removeItemFromActiveFolder"
          >
            <SwipeViews
              :model-value="activeFilter"
              :disabled="isCompact"
              class="flex-1 min-h-0"
              @update:model-value="setFilter($event as LibraryFilter)"
            >
              <TabsContent
                v-for="filter in visibleFilters"
                :key="filter"
                :value="filter"
                force-mount
                as-child
              >
                <SwipeView
                  :value="filter"
                  class="h-full"
                >
                  <LibrarySidebarList
                    v-if="mountedFilters.has(filter)"
                    :items="listItems[filter]"
                    :loading="listLoading"
                    :loading-more="isCatalog && catalog.isLoadingMore.value"
                    :compact="isCompact"
                    :restore-key="`library-sidebar:${catalogKind ?? 'local'}:${filter}`"
                    @scroll="handleScroll"
                    @load-more="catalog.loadMoreAlbums"
                    @open-folder="openFolder"
                    @start-radio="startRadio"
                  />
                </SwipeView>
              </TabsContent>
            </SwipeViews>
          </LibraryContextMenu>
        </Tabs>
      </div>
    </SlideTransition>

    <div
      class="pointer-events-none absolute right-2 bottom-[calc(1rem+var(--mobile-bottom-inset,0px))] z-50 flex gap-2"
      :class="isCompact
        ? 'inset-x-0 flex-col items-center'
        : 'inset-x-4 flex-row items-center'"
    >
      <UpdateButton :compact="isCompact" />

      <FloatingButton
        v-if="!activeFolder && !isCatalog"
        inline
        class="pointer-events-auto"
        :class="!isCompact && 'ml-auto'"
        :show="isButtonVisible"
        @create-folder="openCreateFolderDialog"
      />

      <FloatingActionButton
        v-else-if="activeFolder"
        inline
        class="pointer-events-auto"
        :class="!isCompact && 'ml-auto'"
        :show="isButtonVisible"
      >
        <Button
          class="size-12 rounded-full shadow-lg"
          @click="openFolderPicker(activeFolder.id)"
        >
          <IconPlus class="size-6" />
        </Button>
      </FloatingActionButton>
    </div>

    <SearchPanel />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { TabsContent } from "reka-ui";
import { useI18n } from "vue-i18n";
import FloatingActionButton from "@/components/common/FloatingActionButton.vue";
import SlideTransition from "@/components/transitions/SlideTransition.vue";
import { Button } from "@/components/ui/button";
import FloatingButton from "@/components/layout/sidebar/floatingButton/FloatingButton.vue";
import LibrarySidebarFolderHeader from "@/components/layout/sidebar/LibrarySidebarFolderHeader.vue";
import LibrarySidebarList from "@/components/layout/sidebar/LibrarySidebarList.vue";
import SearchPanel from "@/modules/search/components/SearchPanel.vue";
import SidebarHeader from "@/components/layout/sidebar/header/SidebarHeader.vue";
import { SIDEBAR_COMPACT_KEY } from "@/components/layout/sidebar/sidebarCompact";
import { useLibrarySidebarFolders } from "@/components/layout/sidebar/useLibrarySidebarFolders";
import { Scrollable } from "@/components/ui/scrollable";
import { SwipeView, SwipeViews } from "@/components/ui/swipe-views";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { registerOverlayBackHandler } from "@/composables/useOverlayBackButton";
import LibraryContextMenu from "@/modules/library/components/LibraryContextMenu.vue";
import { useLibrary } from "@/modules/library/composables/useLibrary";
import type { LibraryFilter, LibraryItem } from "@/modules/library/types";
import UpdateButton from "@/modules/update/components/UpdateButton.vue";
import IconPlus from "~icons/tabler/plus";
import { useCurrentSourceStore } from "@/modules/sources/store/currentSource.store";
import { useCatalogLibraryItems } from "@/modules/sources/composables/useCatalogLibraryItems";
import { catalogFilters } from "@/modules/sources/lib/catalog-filters";
import SourceHealthNotice from "@/modules/sources/components/SourceHealthNotice.vue";
import { useYmRadio } from "@/modules/sources/yandex/composables/useYmRadio";

const {
  itemsByFilter,
  availableFilters,
  isLoading,
  activeFilter,
  folders,
  setFilter,
  deleteItem,
  createFolder,
  renameFolder,
  deleteFolder,
  setFolderItems,
  getFolderItems,
} = useLibrary();

const {
  activeFolder,
  closeFolder,
  deleteSidebarFolder,
  folderDepth,
  openCreateFolderDialog,
  openFolder,
  openFolderPicker,
  openRenameFolderDialog,
  removeItemFromActiveFolder,
  renameActiveFolder,
} = useLibrarySidebarFolders({
  folders,
  createFolder,
  renameFolder,
  deleteFolder,
  setFolderItems,
});

// Hardware back leaves an open sidebar folder before falling through to the
// router. Inert on desktop: the coordinator only runs in MobileLayout. The
// folder picker is a right-panel view and has its own back handler there.
// Opening an entity from the folder is not a dismissal: back must land in
// the folder again.
registerOverlayBackHandler({
  depth: () => folderDepth.value,
  back: closeFolder,
  survivesNavigation: true,
});

const { t } = useI18n();
const isCompact = inject(SIDEBAR_COMPACT_KEY, computed(() => false));

const currentSourceStore = useCurrentSourceStore();

// Local rows come from Dexie with pinning and folders behind them, catalog
// rows come off the network and have neither. That split is real and stays;
// what it no longer does is name a particular source.
const catalogKind = computed(() =>
  (currentSourceStore.currentSource === "local" ? null : currentSourceStore.currentSource),
);
const isCatalog = computed(() => catalogKind.value !== null);
const catalog = useCatalogLibraryItems(catalogKind);
// The station row of the Yandex catalog: the only row that plays instead of navigating.
const { start: startRadio } = useYmRadio();

// Every filter keeps a list of its own, one swipe view each.
const listItems = computed(() => (isCatalog.value ? catalog.itemsByFilter.value : itemsByFilter.value));
const listLoading = computed(() => (isCatalog.value ? catalog.isLoading.value : isLoading.value));
const visibleFilters = computed(() =>
  (isCatalog.value ? catalogFilters(catalogKind.value) : availableFilters.value),
);

// The one place the tab strip is rendered is the one place its invariant is
// kept: an active tab that is not in the strip leaves no tab highlighted
// above a permanently empty list. Applies to both lists — a local collection
// that emptied out and a source that cannot list the open tab.
watch(visibleFilters, (filters) => {
  if (filters.length > 0 && !filters.includes(activeFilter.value)) setFilter(filters[0]);
}, { immediate: true });

// Only the list on screen and its neighbours render: every mounted list costs
// its rows at start-up and re-renders on every library change. The list on
// screen mounts at once; its neighbours, which a swipe drags into view, wait
// for an idle moment so it paints first. A list further away unmounts and
// its scroll position comes back with it.
const NEIGHBOUR_IDLE_TIMEOUT_MS = 500;
const mountedFilters = shallowRef(new Set<LibraryFilter>());
let idleHandle: number | undefined;

const cancelIdle = () => {
  if (idleHandle === undefined) return;
  if (typeof cancelIdleCallback === "function") cancelIdleCallback(idleHandle);
  else clearTimeout(idleHandle);
  idleHandle = undefined;
};

const whenIdle = (run: () => void) => {
  cancelIdle();
  idleHandle = typeof requestIdleCallback === "function"
    ? requestIdleCallback(run, { timeout: NEIGHBOUR_IDLE_TIMEOUT_MS })
    : window.setTimeout(run, NEIGHBOUR_IDLE_TIMEOUT_MS);
};

watch([activeFilter, visibleFilters, isCompact], ([active, filters, compact]) => {
  const index = filters.indexOf(active);
  const near = (filter: LibraryFilter) => Math.abs(filters.indexOf(filter) - index) <= 1;
  mountedFilters.value = new Set([...mountedFilters.value].filter(near).concat(active));
  if (compact) return;
  whenIdle(() => {
    idleHandle = undefined;
    mountedFilters.value = new Set(filters.filter(near));
  });
}, { immediate: true });

onBeforeUnmount(cancelIdle);

const filterLabels = computed<Record<LibraryFilter, string>>(() => ({
  all: t("library.filterAll"),
  playlist: t("library.filterPlaylists"),
  artist: t("library.filterArtists"),
  album: t("library.filterAlbums"),
}));

async function handleDeleteItem(item: LibraryItem) {
  if (item.type === "folder") {
    await deleteSidebarFolder(item.id);
    return;
  }

  await deleteItem(item);
}

function filterLabel(value: LibraryFilter) {
  return filterLabels.value[value];
}

const transitionKey = computed(() => (activeFolder.value ? `folder-${activeFolder.value.id}` : "main"));

const isButtonVisible = ref(true);
let lastScrollTop = 0;
const SCROLL_THRESHOLD = 10;
const BOTTOM_THRESHOLD = 30;

function handleScroll(event: Event) {
  const target = event.target as HTMLElement;
  const scrollTop = target.scrollTop;
  const isAtBottom
    = target.scrollHeight - scrollTop - target.clientHeight < BOTTOM_THRESHOLD;

  if (scrollTop < 50 || isAtBottom) {
    isButtonVisible.value = true;
    lastScrollTop = scrollTop;
    return;
  }

  const diff = scrollTop - lastScrollTop;

  if (diff > SCROLL_THRESHOLD && isButtonVisible.value) {
    isButtonVisible.value = false;
  }
  else if (diff < -SCROLL_THRESHOLD && !isButtonVisible.value) {
    isButtonVisible.value = true;
  }

  lastScrollTop = scrollTop;
}
</script>
