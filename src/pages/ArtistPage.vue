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

    <template v-else-if="artistData">
      <TrackContextMenu context="artist">
        <VirtualScrollable
          :items="tracks"
          :get-item-key="getTrackKey"
          :item-height="64"
          :padding-top="16"
          :padding-bottom="16"
          :loading="isFetchingNextTrackPage"
          class="h-full"
          @load-more="handleTrackLoadMore"
        >
          <template #before>
            <MediaHero
              :data="artistData"
              @play="handlePlayAll"
            />
          </template>

          <template #default="{ item, index }">
            <div class="px-4">
              <TrackRow
                :compact="isCompact"
                menu-target="artist"
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

      <TrackDropdown context="artist" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import VirtualScrollable from "@/components/ui/scrollable/VirtualScrollable.vue";
import { Button } from "@/components/ui/button";
import { useLibraryView } from "@/modules/library/composables/useLibraryView";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import TrackContextMenu from "@/modules/tracks/components/menu/context-menu/TrackContextMenu.vue";
import TrackDropdown from "@/modules/tracks/components/menu/dropdown/TrackDropdown.vue";
import TrackRow from "@/modules/tracks/components/TrackRow.vue";
import IconLoader2 from "~icons/tabler/loader-2";
import { useArtistPage } from "@/modules/artists/composables/useArtistPage";
import { getArtistPageData } from "@/queries/artist.queries";
import { getAlbumPageData } from "@/queries/album.queries";
import { AlbumId } from "@/types/ids";
import MediaHero from "@/modules/media-hero/components/MediaHero.vue";
import TrackRowLoading from "@/modules/tracks/components/TrackRowLoading.vue";
import { useTrackSelection } from "@/composables/useTrackSelection";

const { t } = useI18n();
const { isCompact } = useLibraryView();
const queueStore = useQueueStore();
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
  artist,
  albums,
  tracks,
  artistData,
  isLoading,
  error,
  isError,
  refetch,
  fetchNextTrackPage,
  hasNextTrackPage,
  isFetchingNextTrackPage,
  fetchNextAlbumPage,
  hasNextAlbumPage,
  isFetchingNextAlbumPage,
} = useArtistPage();

function getTrackKey(index: number) {
  return tracks.value[index]?.id ?? index;
}

function handleTrackLoadMore() {
  if (!hasNextTrackPage.value || isFetchingNextTrackPage.value) return;
  fetchNextTrackPage();
}

function handleAlbumLoadMore() {
  if (!hasNextAlbumPage.value || isFetchingNextAlbumPage.value) return;
  fetchNextAlbumPage();
}

const errorMessage = computed(() => {
  if (!error.value) return t("errors.unknown");
  const message = error.value.message;
  if (message === "Artist not found") return t("errors.notFound");
  return t("errors.loadFailed");
});

function handlePlayAll() {
  if (!artist.value) return;

  getArtistPageData(artist.value.id).then((data) => {
    if (data && data.tracks.length > 0) {
      queueStore.setQueue(data.tracks, 0, { type: "artist", artistId: artist.value!.id });
    }
  });
}

function handlePlayAlbum(albumId: string) {
  getAlbumPageData(AlbumId(albumId)).then((data) => {
    if (data && data.tracks.length > 0) {
      queueStore.setQueue(data.tracks, 0, { type: "album", albumId: AlbumId(albumId) });
    }
  });
}

async function handlePlayTrack(index: number) {
  if (!artist.value) return;

  const selectedTrack = tracks.value[index];
  if (!selectedTrack) return;

  const data = await getArtistPageData(artist.value.id);
  const fullIndex = data.tracks.findIndex(track => track.id === selectedTrack.id);
  if (fullIndex === -1) return;

  queueStore.setQueue(data.tracks, fullIndex, { type: "artist", artistId: artist.value.id });
}

function selectAllTracks() {
  const ids = tracks.value.map(t => t.id);
  selectAll(ids);
}
</script>
