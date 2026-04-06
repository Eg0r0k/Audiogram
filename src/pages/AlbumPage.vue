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

    <template v-else-if="albumData">
      <TrackContextMenu
        context="album"
        :album-id="album?.id"
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
              :data="albumData"
              @play="handlePlayAll"
              @shuffle="handleShuffle"
              @edit="showEditDialog = true"
              @delete="showDeleteDialog = true"
              @add-to-queue="handleAddToQueue"
              @share="handleShare"
            />
          </template>

          <template #default="{ item, index }">
            <div class="px-4">
              <TrackRow
                :compact="isCompact"
                menu-target="album"
                :track="item"
                :index="index + 1"
                @play="handlePlayTrack(index)"
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
        context="album"
        :album-id="album?.id"
      />
    </template>

    <DeleteAlbumDialog
      v-model:open="showDeleteDialog"
      :album="album"
      :track-count="tracks.length"
      @confirm="handleDelete"
    />

    <EditAlbumDialog
      v-model:open="showEditDialog"
      :album="album"
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
import { useAlbumPage } from "@/modules/albums/composables/useAlbumPage";
import { getAlbumPageData } from "@/queries/album.queries";
import DeleteAlbumDialog from "@/modules/albums/components/dialogs/DeleteAlbumDialog.vue";
import EditAlbumDialog from "@/modules/albums/components/dialogs/EditAlbumDialog.vue";
import MediaHero from "@/modules/media-hero/components/MediaHero.vue";
import TrackRowLoading from "@/modules/tracks/components/TrackRowLoading.vue";

interface AlbumChanges {
  title?: string;
  description?: string;
  coverBlob?: Blob;
  removeCover?: boolean;
}

const { t } = useI18n();
const { isCompact } = useLibraryView();
const queueStore = useQueueStore();

const {
  album,
  tracks,
  albumData,
  coverUrl,
  isLoading,
  isError,
  error,
  deleteAlbum,
  updateAlbum,
  refetch,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useAlbumPage();

const showDeleteDialog = ref(false);
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
  if (error.value.message === "Album not found") return t("errors.notFound");
  return t("errors.loadFailed");
});

function handlePlayAll() {
  if (!album.value) return;

  getAlbumPageData(album.value.id).then((data) => {
    if (data && data.tracks.length > 0) {
      queueStore.setQueue(data.tracks, 0, {
        type: "album",
        albumId: album.value!.id,
      });
    }
  });
}

async function handlePlayTrack(index: number) {
  if (!album.value) return;

  const selectedTrack = tracks.value[index];
  if (!selectedTrack) return;

  const data = await getAlbumPageData(album.value.id);
  const fullIndex = data.tracks.findIndex(track => track.id === selectedTrack.id);
  if (fullIndex === -1) return;

  queueStore.setQueue(data.tracks, fullIndex, {
    type: "album",
    albumId: album.value.id,
  });
}

function handleAddToQueue() {
  if (tracks.value.length === 0) return;
  queueStore.addMultipleToQueue(tracks.value);
}

function handleShare() {
  toast.info(t("common.comingSoon"));
}

async function handleDelete() {
  try {
    await deleteAlbum();
    showDeleteDialog.value = false;
    toast.success(t("album.deleted"));
  }
  catch {
    toast.error(t("album.deleteFailed"));
  }
}

async function handleSave(changes: AlbumChanges) {
  try {
    await updateAlbum(changes);
    showEditDialog.value = false;
  }
  catch (e) {
    const message = e instanceof Error ? e.message : t("album.updateFailed");
    toast.error(message);
  }
}

function handleShuffle() {
  if (tracks.value.length === 0 || !album.value) return;
  queueStore.setQueue(tracks.value, 0, {
    type: "album",
    albumId: album.value.id,
  });
  queueStore.toggleShuffle();
}
</script>
