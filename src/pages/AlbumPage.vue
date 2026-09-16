<template>
  <div
    class="track-list-grid flex-1 min-h-0"
  >
    <template v-if="isLoading">
      <div class="flex items-center justify-center h-full">
        <Spinner class="size-8 text-muted-foreground" />
      </div>
    </template>

    <template v-else-if="isError">
      <PageErrorState
        :message="errorMessage"
        @retry="refetch"
      />
    </template>

    <template v-else-if="albumData">
      <TrackContextMenu
        context="album"
        :album-id="album?.id"
      >
        <div
          class="h-full"
        >
          <VirtualScrollable
            ref="scrollableRef"
            :items="tracks"
            :get-item-key="getTrackKey"
            :item-height="56"
            :load-more-offset="120"
            :padding-top="16"
            :padding-bottom="16"
            sticky-offset="72px"
            :loading="isTracksLoading || isFetchingNextPage"
            class="h-full"
            @load-more="handleLoadMore"
          >
            <template #before>
              <MediaHero
                v-model:filter="searchQuery"
                :data="albumData"
                :has-tracks="tracks.length > 0"
                :is-library-entity="!!album"
                :filterable="!!album"
                :like="like.state.value"
                @play="handlePlayAll"
                @shuffle="handleShuffle"
                @edit="openEditDialog"
                @delete="openDeleteDialog"
                @add-to-queue="handleAddToQueue"
              />
            </template>

            <template #leading>
              <div class="px-4">
                <AddTrackRow
                  v-if="album"
                  @add="openAddTracksPanel"
                />
              </div>
            </template>

            <template #sticky>
              <LibrarySortHeader
                v-model:sort-key="sortKey"
                :sortable="canSort"
              />
            </template>

            <template #default="{ item, index }">
              <div class="px-4">
                <TrackExpanded
                  :show-cover="false"
                  :track="item"
                  :index="index + 1"
                  :is-active="currentTrackId === item.id"
                  menu-target="album"
                  @play="handlePlayTrack(index)"
                  @contextmenu="handleContextMenu(item, index)"
                />
              </div>
            </template>

            <template #loader>
              <div class="flex items-center px-4 flex-col w-full">
                <TrackRowLoading />
              </div>
            </template>
          </VirtualScrollable>
        </div>
      </TrackContextMenu>

      <TrackDropdown
        context="album"
        :album-id="album?.id"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import { sourceKindOf } from "@/modules/sources/lib/display";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { useScrollRestoration } from "@/components/ui/scrollable/useScrollRestoration";
import VirtualScrollable from "@/components/ui/scrollable/VirtualScrollable.vue";
import PageErrorState from "@/components/common/PageErrorState.vue";
import { useEntityPlayback } from "@/modules/queue/composables/useEntityPlayback";
import type { QueueSource } from "@/modules/queue/types";
import { useRightPanelStore } from "@/modules/right-panel/store/right-panel.store";
import TrackContextMenu from "@/modules/tracks/components/menu/context-menu/TrackContextMenu.vue";
import TrackDropdown from "@/modules/tracks/components/menu/dropdown/TrackDropdown.vue";
import { useAlbumPage } from "@/modules/albums/composables/useAlbumPage";
import { useEntityLike } from "@/modules/sources/composables/useEntityLike";
import { getAlbumPageData } from "@/queries/album.queries";
import { searchAlbumTracks } from "@/queries/track.queries";
import MediaHero from "@/modules/media-hero/components/MediaHero.vue";
import TrackRowLoading from "@/modules/tracks/components/TrackRowLoading.vue";
import { summonDialog } from "@/components/dialogs/summonDialog";
import { useEditAlbumDialog } from "@/modules/albums/composables/useEditAlbumDialog";
import { Spinner } from "@/components/ui/spinner";
import type { TrackSortKey } from "@/modules/tracks/types";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useTrackMenu } from "@/modules/tracks/composables/useTrackMenu";
import type { Track } from "@/modules/player/types";
import LibrarySortHeader from "@/modules/library/components/LibrarySortHeader.vue";
import TrackExpanded from "@/modules/tracks/components/TrackExpanded.vue";
import AddTrackRow from "@/modules/tracks/components/AddTrackRow.vue";
import { getLogger } from "@/lib/logger";

const { t } = useI18n();
const playerStore = usePlayerStore();
const rightPanelStore = useRightPanelStore();
const { openMenu } = useTrackMenu();
const route = useRoute();
const sortKey = ref<TrackSortKey | null>(null);
const searchQuery = ref("");

const {
  remoteKind,
  album,
  tracks,
  canSort,
  normalizedSearchQuery,
  albumData,
  coverUrl,
  trackCount,
  isLoading,
  isError,
  error,
  deleteAlbum,
  updateAlbum,
  refetch,
  fetchNextPage,
  hasNextPage,
  isTracksLoading,
  isFetchingNextPage,
} = useAlbumPage(sortKey, searchQuery);

const albumId = computed(() => route.params.id as string);
const like = useEntityLike(remoteKind, "album", albumId);

const editAlbum = useEditAlbumDialog();
const currentTrackId = computed(() => playerStore.currentTrack?.id ?? null);

const errorMessage = computed(() => {
  if (!error.value) return t("errors.unknown");
  if (error.value.message === "Album not found") return t("errors.notFound");
  return t("errors.loadFailed");
});

function getTrackKey(index: number) {
  return tracks.value[index]?.id ?? index;
}

function openAddTracksPanel() {
  if (!album.value) return;
  rightPanelStore.openAddTracks(
    { entityType: "album", entityId: album.value.id, onConfirmed: () => refetch() },
    { scope: { type: "route", routeKey: route.fullPath }, depth: 1 },
  );
}

function handleLoadMore() {
  if (!hasNextPage.value || isFetchingNextPage.value) return;
  // The query keeps its own error state for the UI; the log is what tells us
  // WHY a scroll stopped loading more album tracks.
  fetchNextPage().catch((err: unknown) => {
    getLogger().warn(`[AlbumPage] Loading the next album tracks page failed: ${String(err)}`);
  });
}

function handleContextMenu(track: Track, index: number) {
  openMenu(track, index, { target: "album" });
}

const queueSource = computed<QueueSource | null>(() => {
  const vm = albumData.value;
  return vm ? { type: "album", albumId: vm.id } : null;
});

const {
  playAll: handlePlayAll,
  playTrack: handlePlayTrack,
  shuffle: handleShuffle,
  addToQueue: handleAddToQueue,
} = useEntityPlayback({
  tracks,
  source: queueSource,
  // The catalog path has no Dexie rows to page through — getAlbum handed the
  // album over whole, already in the page's sort order.
  isComplete: computed(() => !album.value),
  loadAll: async () => {
    const row = album.value;
    if (!row) return [];
    const query = normalizedSearchQuery.value;
    if (query) {
      return (await searchAlbumTracks(row.id, query, 0, Infinity, sortKey.value)).tracks;
    }
    return (await getAlbumPageData(row.id, sortKey.value)).tracks;
  },
});

async function openDeleteDialog() {
  if (!album.value) return;
  const result = await summonDialog("deleteConfirm", {
    data: {
      type: "album",
      id: album.value.id,
      name: album.value.title,
      trackCount: trackCount.value,
      defaultDeleteTracks: sourceKindOf(album.value.id) !== "local",
    },
  }, { key: `delete:${album.value.id}` });
  if (result) await handleDelete(result.deleteTracks);
}

async function handleDelete(deleteTracks: boolean) {
  try {
    await deleteAlbum({ deleteTracks });
    toast.success(t("album.deleted"));
  }
  catch {
    toast.error(t("album.deleteFailed"));
  }
}

const openEditDialog = () => {
  if (!album.value) return;
  editAlbum(album.value, coverUrl.value, async (changes) => {
    try {
      await updateAlbum(changes);
    }
    catch (e) {
      toast.error(e instanceof Error ? e.message : t("album.updateFailed"));
      throw e;
    }
  }).catch(() => undefined);
};

const scrollableRef = useTemplateRef("scrollableRef");
// Declared after the page state it reads: the hook evaluates `ready`
// immediately, so placing this any earlier hits the temporal dead zone.
useScrollRestoration(scrollableRef, {
  key: () => `album:${String(route.params.id)}`,
  ready: () => !isLoading.value,
  deps: () => tracks.value.length,
});

</script>
