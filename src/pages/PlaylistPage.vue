<template>
  <div class="flex-1 min-h-0">
    <template v-if="isLoading">
      <div class="flex items-center justify-center h-full">
        <IconLoader2 class="size-8 animate-spin text-muted-foreground" />
      </div>
    </template>

    <template v-else-if="isError">
      <div class="flex flex-col items-center justify-center h-full gap-1">
        <div class="flex flex-col items-center pb-4">
          <h2 class="text-2xl font-bold mb-2">
            {{ $t("errors.title") }}
          </h2>
          <p class="text-lg text-muted-foreground">
            {{ errorMessage }}
          </p>
        </div>
        <Button
          size="xl"
          @click="refetch"
        >
          {{ $t("common.retry") }}
        </Button>
      </div>
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
          :item-height="64"
          :load-more-offset="120"
          :padding-top="16"
          :padding-bottom="16"
          :loading="isFetchingNextPage"
          class="h-full"
          @load-more="handleLoadMore"
        >
          <template #before>
            <MediaHero
              :data="playlistData"
              @play="handlePlayAll"
              @edit="showEditDialog = true"
              @delete="openDeleteDialog"
              @add-to-queue="handleAddToQueue"
              @share="handleShare"
            />
            <div
              v-if="isSelectionMode"
              class="flex items-center gap-2 px-4 pb-2"
            >
              <Button
                variant="ghost"
                size="sm"
                @click="selectAllTracks"
              >
                {{ $t("common.selectAll") }}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                @click="deselectAll"
              >
                {{ $t("common.deselectAll") }}
              </Button>
              <span class="text-sm text-muted-foreground">
                {{ selectedCount }} {{ $t("common.selected") }}
              </span>
              <Button
                variant="ghost"
                size="sm"
                @click="exitSelectionMode"
              >
                {{ $t("common.cancel") }}
              </Button>
            </div>
            <div
              v-else
              class="flex items-center gap-2 px-4 pb-2"
            >
              <Button
                variant="ghost"
                size="sm"
                @click="enterSelectionMode"
              >
                {{ $t("common.select") }}
              </Button>
            </div>
          </template>

          <template #default="{ item, index }">
            <div class="px-4">
              <TrackRow
                :compact="isCompact"
                menu-target="playlist"
                :track="item"
                :index="index + 1"
                :selectable="isSelectionMode"
                :is-selected="isSelected(item.id)"
                @play="handlePlayTrack(index)"
                @toggle-select="toggleSelect"
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
import VirtualScrollable from "@/components/ui/scrollable/VirtualScrollable.vue";
import { Button } from "@/components/ui/button";
import { useLibraryView } from "@/modules/library/composables/useLibraryView";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import TrackContextMenu from "@/modules/tracks/components/menu/context-menu/TrackContextMenu.vue";
import TrackDropdown from "@/modules/tracks/components/menu/dropdown/TrackDropdown.vue";
import TrackRow from "@/modules/tracks/components/TrackRow.vue";
import IconLoader2 from "~icons/tabler/loader-2";
import { PlaylistChanges, usePlaylistPage } from "@/modules/playlist/composables/usePlaylistPage";
import { getPlaylistPageData } from "@/queries/playlist.queries";
import EditPlaylistDialog from "@/modules/playlist/components/dialogs/EditPlaylistDialog.vue";
import MediaHero from "@/modules/media-hero/components/MediaHero.vue";
import TrackRowLoading from "@/modules/tracks/components/TrackRowLoading.vue";
import { useDeleteConfirmDialog } from "@/composables/useDeleteConfirmDialog";
import { useTrackSelection } from "@/composables/useTrackSelection";

const { t } = useI18n();
const { isCompact } = useLibraryView();
const queueStore = useQueueStore();
const { openDeleteDialog: openGlobalDeleteDialog } = useDeleteConfirmDialog();
const {
  isSelectionMode,
  enterSelectionMode,
  exitSelectionMode,
  isSelected,
  toggleSelect,
  selectAll,
  deselectAll,
  selectedCount,
} = useTrackSelection();

const {
  playlist,
  tracks,
  playlistData,
  isLoading,
  isError,
  coverUrl,
  error,
  deletePlaylist,
  updatePlaylist,
  refetch,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = usePlaylistPage();

const showEditDialog = ref(false);

function getTrackKey(index: number) {
  return tracks.value[index]?.id ?? index;
}

function handleLoadMore() {
  if (!hasNextPage.value || isFetchingNextPage.value) return;
  fetchNextPage();
}

const errorMessage = computed(() => {
  if (!error.value) return t("errors.unknown");
  if (error.value.message === "Playlist not found") return t("errors.notFound");
  return t("errors.loadFailed");
});

function handlePlayAll() {
  if (!playlist.value) return;

  getPlaylistPageData(playlist.value.id).then((data) => {
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

  const data = await getPlaylistPageData(playlist.value.id);
  const fullIndex = data.tracks.findIndex(track => track.id === selectedTrack.id);
  if (fullIndex === -1) return;

  queueStore.setQueue(data.tracks, fullIndex, {
    type: "playlist",
    playlistId: playlist.value.id,
  });
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
    trackCount: tracks.value.length,
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

function selectAllTracks() {
  const ids = tracks.value.map(t => t.id);
  selectAll(ids);
}
</script>
