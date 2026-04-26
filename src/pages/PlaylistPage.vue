<template>
  <div
    class="flex-1 min-h-0"
    :style="gridStyles"
  >
    <template v-if="isLoading">
      <div class="flex items-center justify-center h-full">
        <IconLoader2 class="size-8 animate-spin text-muted-foreground" />
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
        :is-playlist-owner="true"
      >
        <VirtualScrollable
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
              :data="playlistData"
              :has-tracks="tracks.length > 0"
              @play="handlePlayAll"
              @shuffle="handleShuffle"
              @edit="showEditDialog = true"
              @delete="openDeleteDialog"
              @add-to-queue="handleAddToQueue"
              @share="handleShare"
            >
              <template #actions>
                <Button
                  variant="ghost"
                  class="text-white"
                  @click="openAddTracksPanel"
                >
                  <IconPlus class="size-5" />
                  {{ $t("playlist.addTracks") }}
                </Button>
              </template>
            </MediaHero>
          </template>

          <template #sticky>
            <LibrarySortHeader
              :sort-key="sortKey"
              @toggle-title="toggleTitleSort"
              @toggle-album="toggleAlbumSort"
              @toggle-date="toggleDateSort"
              @toggle-duration="toggleDurationSort"
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
          <template
            #empty
          >
            <div class="p-4">
              <Button
                size="lg"
                variant="secondary"
                class="w-full rounded-full"
                @click="openAddTracksPanel"
              >
                <IconPlus class="size-5" />
                {{ $t("playlist.addTracks") }}
              </Button>
            </div>
          </template>
        </VirtualScrollable>
      </TrackContextMenu>

      <TrackDropdown
        context="playlist"
        :playlist-id="playlist?.id"
        :is-playlist-owner="true"
      />
    </template>

    <EditPlaylistDialog
      v-model:open="showEditDialog"
      :playlist="playlist"
      :current-cover-url="coverUrl"
      @save="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import VirtualScrollable from "@/components/ui/scrollable/VirtualScrollable.vue";
import PageErrorState from "@/components/common/PageErrorState.vue";
import { Button } from "@/components/ui/button";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { useRightPanelStore } from "@/modules/right-panel/store/right-panel.store";
import TrackContextMenu from "@/modules/tracks/components/menu/context-menu/TrackContextMenu.vue";
import TrackDropdown from "@/modules/tracks/components/menu/dropdown/TrackDropdown.vue";
import IconLoader2 from "~icons/tabler/loader-2";
import { PlaylistChanges, usePlaylistPage } from "@/modules/playlist/composables/usePlaylistPage";
import { getPlaylistPageData } from "@/queries/playlist.queries";
import EditPlaylistDialog from "@/modules/playlist/components/dialogs/EditPlaylistDialog.vue";
import MediaHero from "@/modules/media-hero/components/MediaHero.vue";
import TrackRowLoading from "@/modules/tracks/components/TrackRowLoading.vue";
import { useDeleteConfirmDialog } from "@/composables/useDeleteConfirmDialog";
import IconPlus from "~icons/tabler/plus";
import { isSameQueueSource } from "@/modules/queue/types";
import { getSecureRandomIndex } from "@/lib/random";
import type { TrackSortKey } from "@/modules/tracks/types";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useTrackMenu } from "@/modules/tracks/composables/useTrackMenu";
import type { Track } from "@/modules/player/types";
import LibrarySortHeader from "@/modules/library/components/LibrarySortHeader.vue";
import TrackExpanded from "@/modules/tracks/components/TrackExpanded.vue";

const { t } = useI18n();
const queueStore = useQueueStore();
const playerStore = usePlayerStore();
const rightPanelStore = useRightPanelStore();
const { openDeleteDialog: openGlobalDeleteDialog } = useDeleteConfirmDialog();
const { openMenu } = useTrackMenu();
const route = useRoute();
const sortKey = ref<TrackSortKey | null>(null);

const gridStyles = {
  "--index-column-width": "32px",
  "--first-min-width": "180px",
  "--first-max-width": "4fr",
  "--var1-min-width": "120px",
  "--var1-max-width": "2fr",
  "--var2-min-width": "120px",
  "--var2-max-width": "2fr",
  "--last-min-width": "80px",
  "--last-max-width": "1fr",

  "--grid-template-columns": `
    [index] var(--index-column-width) 
    [first] minmax(var(--first-min-width), var(--first-max-width)) 
    [var1] minmax(var(--var1-min-width), var(--var1-max-width)) 
    [var2] minmax(var(--var2-min-width), var(--var2-max-width)) 
    [last] minmax(var(--last-min-width), var(--last-max-width))
  `,
};

const {
  playlist,
  tracks,
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
} = usePlaylistPage(sortKey);

const showEditDialog = ref(false);
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
  fetchNextPage();
}

function setSortKey(nextSortKey: TrackSortKey | null) {
  sortKey.value = nextSortKey;
}

function toggleTitleSort() {
  if (sortKey.value !== "title_asc" && sortKey.value !== "title_desc") {
    setSortKey("title_asc");
    return;
  }

  setSortKey(sortKey.value === "title_asc" ? "title_desc" : null);
}

function toggleDateSort() {
  if (sortKey.value !== "date_added_asc" && sortKey.value !== "date_added_desc") {
    setSortKey("date_added_asc");
    return;
  }

  setSortKey(sortKey.value === "date_added_asc" ? "date_added_desc" : null);
}

function toggleDurationSort() {
  if (sortKey.value !== "duration_asc" && sortKey.value !== "duration_desc") {
    setSortKey("duration_asc");
    return;
  }

  setSortKey(sortKey.value === "duration_asc" ? "duration_desc" : null);
}

function toggleAlbumSort() {
  if (sortKey.value !== "album_asc" && sortKey.value !== "album_desc") {
    setSortKey("album_asc");
    return;
  }

  setSortKey(sortKey.value === "album_asc" ? "album_desc" : null);
}

function handleContextMenu(track: Track, index: number) {
  openMenu(track, index, { target: "playlist" });
}

const errorMessage = computed(() => {
  if (!error.value) return t("errors.unknown");
  if (error.value.message === "Playlist not found") return t("errors.notFound");
  return t("errors.loadFailed");
});

function handlePlayAll() {
  if (!playlist.value) return;

  getPlaylistPageData(playlist.value.id, sortKey.value).then((data) => {
    if (data && data.tracks.length > 0) {
      queueStore.setQueue(data.tracks, 0, {
        type: "playlist",
        playlistId: playlist.value!.id,
      });
    }
  });
}

async function handlePlayTrack(index: number) {
  if (!playlist.value) return;

  const selectedTrack = tracks.value[index];
  if (!selectedTrack) return;

  if (currentTrackId.value === selectedTrack.id) {
    playerStore.togglePlay();
    return;
  }

  const data = await getPlaylistPageData(playlist.value.id, sortKey.value);
  const fullIndex = data.tracks.findIndex(track => track.id === selectedTrack.id);
  if (fullIndex === -1) return;

  await queueStore.setQueue(data.tracks, fullIndex, {
    type: "playlist",
    playlistId: playlist.value.id,
  });
}

async function handleShuffle() {
  if (!playlist.value) return;

  const source = {
    type: "playlist",
    playlistId: playlist.value.id,
  } as const;

  if (queueStore.currentItem && isSameQueueSource(queueStore.currentItem.source, source)) {
    queueStore.toggleShuffle();
    return;
  }

  const data = await getPlaylistPageData(playlist.value.id, sortKey.value);
  if (data.tracks.length === 0) return;

  const randomIndex = getSecureRandomIndex(data.tracks.length);
  await queueStore.setQueue(data.tracks, randomIndex, source, { shuffled: true });
}

function handleAddToQueue() {
  if (tracks.value.length === 0) return;
  queueStore.addMultipleToQueue(tracks.value);
}

function handleShare() {
  toast.info(t("common.comingSoon"));
}

function openDeleteDialog() {
  if (!playlist.value) return;
  openGlobalDeleteDialog({
    type: "playlist",
    id: playlist.value.id,
    name: playlist.value.name,
    trackCount: trackCount.value,
  }, handleDelete);
}

async function handleDelete() {
  try {
    await deletePlaylist();
  }
  catch {
    toast.error(t("playlist.deleteFailed"));
  }
}

async function handleSave(changes: PlaylistChanges) {
  try {
    await updatePlaylist(changes);
    showEditDialog.value = false;
  }
  catch (e) {
    const message = e instanceof Error ? e.message : t("playlist.updateFailed");
    toast.error(message);
  }
}
</script>
