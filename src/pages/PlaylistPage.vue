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
        :is-playlist-owner="canRemoveTracks"
      >
        <VirtualScrollable
          ref="scrollableRef"
          :items="tracks"
          :get-item-key="getTrackKey"
          :item-height="56"
          :load-more-offset="120"
          :padding-top="8"
          :padding-bottom="8"
          sticky-offset="72px"
          :loading="isTracksLoading || isFetchingNextPage"
          class="h-full bg-card [--sticky-surface:var(--card)]"
          @load-more="handleLoadMore"
        >
          <template #before>
            <MediaHero
              v-model:filter="searchQuery"
              :data="playlistData"
              :has-tracks="tracks.length > 0"
              :is-library-entity="!!playlist"
              :filterable="!!playlist"
              :catalog-route="catalogViewRoute('playlist', playlistId, !!playlist)"
              :like="playlistData.isOwner ? undefined : like.state.value"
              :can-delete-at-source="canDeleteAtSource"
              :can-add-tracks="!!playlist"
              @play="handlePlayAll"
              @shuffle="handleShuffle"
              @edit="openEditDialog"
              @delete="openDeleteDialog"
              @add-to-queue="handleAddToQueue"
              @add-tracks="openAddTracksPanel"
            />
          </template>

          <template
            v-if="!isMobileLayout"
            #sticky
          >
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
              />
            </div>
          </template>

          <template
            v-if="isFetchNextPageError"
            #load-more-error
          >
            <LoadMoreError @retry="handleLoadMore" />
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
        :is-playlist-owner="canRemoveTracks"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import LoadMoreError from "@/components/common/LoadMoreError.vue";
import { computed, ref, useTemplateRef } from "vue";
import { loadErrorText, reportError } from "@/app/error-feedback";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { useDeviceLayout } from "@/composables/useDeviceLayout";
import { catalogViewRoute } from "@/app/router/route-locations";
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
import LibrarySortHeader from "@/modules/library/components/LibrarySortHeader.vue";
import TrackExpanded from "@/modules/tracks/components/TrackExpanded.vue";
import { getLogger } from "@/lib/logger";
import { formatError } from "@/lib/errors";

const { t } = useI18n();
const playerStore = usePlayerStore();
const rightPanelStore = useRightPanelStore();
const route = useRoute();
const { isMobileLayout } = useDeviceLayout();
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
  canDeleteAtSource,
  deleteAtSource,
  updatePlaylist,
  refetch,
  fetchNextPage,
  hasNextPage,
  isTracksLoading,
  isFetchingNextPage,
  isFetchNextPageError,
} = usePlaylistPage(sortKey, searchQuery);

const playlistId = computed(() => route.params.id as string);
const like = useEntityLike(remoteKind, "playlist", playlistId);

// A catalog playlist is the source's list: no provider removes a track from
// one, so its track menu offers no removal. An own YM playlist still reports
// isOwner, which only the hero's delete-at-source reads.
const canRemoveTracks = computed(() => !remoteKind.value);

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
    getLogger().warn(`[PlaylistPage] Loading the next playlist tracks page failed: ${formatError(err)}`);
  });
}

const errorMessage = computed(() => error.value ? loadErrorText(error.value) : t("errors.unknown"));

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

const openDeleteDialog = async () => {
  if (playlist.value) {
    const result = await summonDialog("deleteConfirm", {
      data: {
        type: "playlist",
        id: playlist.value.id,
        name: playlist.value.name,
        trackCount: trackCount.value,
      },
    }, { key: `delete:${playlist.value.id}` });
    if (result) await handleDelete(result.deleteTracks);
    return;
  }

  const data = playlistData.value;
  if (!data || !canDeleteAtSource.value || !remoteKind.value) return;
  const confirmed = await summonDialog("deleteConfirm", {
    data: {
      type: "playlist",
      id: data.id,
      name: data.title,
      trackCount: data.trackCount,
      atSource: t(`source.${remoteKind.value}`),
    },
  }, { key: `delete:${data.id}` });
  if (!confirmed) return;
  if (!(await deleteAtSource())) reportError(null, { title: t("playlist.deleteFailed"), scope: "Playlist" });
};

async function handleDelete(deleteTracks: boolean) {
  try {
    await deletePlaylist({ deleteTracks });
  }
  catch (error) {
    reportError(error, { title: t("playlist.deleteFailed"), scope: "Playlist" });
  }
}

const openEditDialog = () => {
  if (!playlist.value) return;
  editPlaylist(playlist.value, coverUrl.value, async (changes) => {
    try {
      await updatePlaylist(changes);
    }
    catch (e) {
      getLogger().error(`[PlaylistPage] Updating the playlist failed: ${formatError(e)}`);
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
