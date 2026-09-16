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

    <template v-else-if="playlistData">
      <TrackContextMenu
        context="playlist"
        :playlist-id="playlist?.id"
        :is-playlist-owner="playlistData?.isOwner ?? true"
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
              :data="playlistData"
              :has-tracks="tracks.length > 0"
              :is-library-entity="!!playlist"
              :filterable="!!playlist"
              :like="playlistData.isOwner ? undefined : like.state.value"
              @play="handlePlayAll"
              @shuffle="handleShuffle"
              @edit="openEditDialog"
              @delete="openDeleteDialog"
              @add-to-queue="handleAddToQueue"
              @share="handleShare"
            />
          </template>

          <template #leading>
            <div class="px-4">
              <AddTrackRow
                v-if="playlist"
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
                :track="item"
                :index="index + 1"
                :is-active="currentTrackId === item.id"
                menu-target="playlist"
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
      </TrackContextMenu>

      <TrackDropdown
        context="playlist"
        :playlist-id="playlist?.id"
        :is-playlist-owner="playlistData?.isOwner ?? true"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
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
import { usePlaylistPage } from "@/modules/playlist/composables/usePlaylistPage";
import { useEntityLike } from "@/modules/sources/composables/useEntityLike";
import MediaHero from "@/modules/media-hero/components/MediaHero.vue";
import TrackRowLoading from "@/modules/tracks/components/TrackRowLoading.vue";
import { summonDialog } from "@/components/dialogs/summonDialog";
import { useEditPlaylistDialog } from "@/modules/playlist/composables/useEditPlaylistDialog";
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
  playlist,
  tracks,
  canSort,
  isComplete,
  loadAllTracks,
  playlistData,
  isLoading,
  isError,
  coverUrl,
  trackCount,
  error,
  deletePlaylist,
  updatePlaylist,
  refetch,
  fetchNextPage,
  hasNextPage,
  isTracksLoading,
  isFetchingNextPage,
} = usePlaylistPage(sortKey, searchQuery);

const playlistId = computed(() => route.params.id as string);
const like = useEntityLike(remoteKind, "playlist", playlistId);

const editPlaylist = useEditPlaylistDialog();
const currentTrackId = computed(() => playerStore.currentTrack?.id ?? null);

function getTrackKey(index: number) {
  return tracks.value[index]?.id ?? index;
}

function openAddTracksPanel() {
  if (!playlist.value) return;

  rightPanelStore.openAddTracks({
    entityType: "playlist",
    entityId: playlist.value.id,
    onConfirmed: () => refetch(),
  }, {
    scope: { type: "route", routeKey: route.fullPath },
    depth: 1,
  });
}

function handleLoadMore() {
  if (!hasNextPage.value || isFetchingNextPage.value) return;
  // The query keeps its own error state for the UI; the log is what tells us
  // WHY a scroll stopped loading more playlist tracks.
  fetchNextPage().catch((err: unknown) => {
    getLogger().warn(`[PlaylistPage] Loading the next playlist tracks page failed: ${String(err)}`);
  });
}

function handleContextMenu(track: Track, index: number) {
  openMenu(track, index, { target: "playlist" });
}

const errorMessage = computed(() => {
  if (!error.value) return t("errors.unknown");
  if (error.value.message === "Playlist not found") return t("errors.notFound");
  return t("errors.loadFailed");
});

const queueSource = computed<QueueSource | null>(() => {
  const vm = playlistData.value;
  return vm ? { type: "playlist", playlistId: vm.id } : null;
});

const {
  playAll: handlePlayAll,
  playTrack: handlePlayTrack,
  shuffle: handleShuffle,
  addToQueue: handleAddToQueue,
} = useEntityPlayback({
  tracks,
  source: queueSource,
  isComplete,
  loadAll: loadAllTracks,
});

function handleShare() {
  toast.info(t("common.comingSoon"));
}

async function openDeleteDialog() {
  if (!playlist.value) return;
  const result = await summonDialog("deleteConfirm", {
    data: {
      type: "playlist",
      id: playlist.value.id,
      name: playlist.value.name,
      trackCount: trackCount.value,
    },
  }, { key: `delete:${playlist.value.id}` });
  if (result) await handleDelete(result.deleteTracks);
}

async function handleDelete(deleteTracks: boolean) {
  try {
    await deletePlaylist({ deleteTracks });
  }
  catch {
    toast.error(t("playlist.deleteFailed"));
  }
}

const openEditDialog = () => {
  if (!playlist.value) return;
  editPlaylist(playlist.value, coverUrl.value, async (changes) => {
    try {
      await updatePlaylist(changes);
    }
    catch (e) {
      toast.error(e instanceof Error ? e.message : t("playlist.updateFailed"));
      throw e;
    }
  }).catch(() => undefined);
};

const scrollableRef = useTemplateRef("scrollableRef");
// Declared after the page state it reads: the hook evaluates `ready`
// immediately, so placing this any earlier hits the temporal dead zone.
useScrollRestoration(scrollableRef, {
  key: () => `playlist:${String(route.params.id)}`,
  ready: () => !isLoading.value,
  deps: () => tracks.value.length,
});

</script>
