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

    <template v-else-if="artistData">
      <TrackContextMenu context="artist">
        <VirtualScrollable
          :items="tracks"
          :get-item-key="getTrackKey"
          :item-height="56"
          :padding-top="16"
          :padding-bottom="16"
          sticky-offset="72px"
          :loading="isTracksLoading || isFetchingNextTrackPage"
          class="h-full"
          @load-more="handleTrackLoadMore"
        >
          <template #before>
            <MediaHero
              :data="artistData"
              :has-tracks="tracks.length > 0"
              @play="handlePlayAll"
              @shuffle="handleShuffle"
              @edit="showEditDialog = true"
              @delete="openDeleteDialog"
            >
              <!-- <template #actions>
                <Button
                  class="text-white"
                  variant="ghost"
                  @click="openAddTracksPanel"
                >
                  <IconPlus class="size-5" />
                  {{ $t("track.addTracks") }}
                </Button>
              </template> -->
            </MediaHero>
            <section
              v-if="albums.length > 0"
              class="p-4"
            >
              <div class="flex items-center justify-between gap-4">
                <div>
                  <h2 class="text-xl font-semibold">
                    {{ $t('album.album') }}
                  </h2>

                  <p class="text-sm text-muted-foreground">
                    {{ $t('common.albums', {count: albumCount}) }}
                  </p>
                </div>
              </div>
              <div class="flex  items-center text-muted-foreground flex-col w-full">
                <IconLogo class=" size-10 mb-1 " />
                <span class=" font-medium">
                  {{ $t('common.comingSoon') }}
                </span>
              </div>
            </section>
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
                menu-target="artist"
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

      <TrackDropdown context="artist" />
      <EditArtistDialog
        v-model:open="showEditDialog"
        :artist="artist"
        :current-cover-url="coverUrl"
        @save="handleSave"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import VirtualScrollable from "@/components/ui/scrollable/VirtualScrollable.vue";
import PageErrorState from "@/components/common/PageErrorState.vue";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import TrackContextMenu from "@/modules/tracks/components/menu/context-menu/TrackContextMenu.vue";
import TrackDropdown from "@/modules/tracks/components/menu/dropdown/TrackDropdown.vue";
import IconLoader2 from "~icons/tabler/loader-2";
import IconLogo from "~icons/audiogram/logo";

import { useArtistPage } from "@/modules/artists/composables/useArtistPage";
import { getArtistPageData } from "@/queries/artist.queries";
import MediaHero from "@/modules/media-hero/components/MediaHero.vue";
import TrackRowLoading from "@/modules/tracks/components/TrackRowLoading.vue";
import { useDeleteConfirmDialog } from "@/composables/useDeleteConfirmDialog";
import { isSameQueueSource } from "@/modules/queue/types";
import { getSecureRandomIndex } from "@/lib/random";
import EditArtistDialog from "@/modules/artists/components/dialogs/EditArtistDialog.vue";
import type { ArtistChanges } from "@/modules/artists/composables/useArtistPage";
import type { TrackSortKey } from "@/modules/tracks/types";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useTrackMenu } from "@/modules/tracks/composables/useTrackMenu";
import type { Track } from "@/modules/player/types";
import LibrarySortHeader from "@/modules/library/components/LibrarySortHeader.vue";
import TrackExpanded from "@/modules/tracks/components/TrackExpanded.vue";
const { t } = useI18n();
const queueStore = useQueueStore();
const playerStore = usePlayerStore();
const { openDeleteDialog: openGlobalDeleteDialog } = useDeleteConfirmDialog();
const { openMenu } = useTrackMenu();
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
  artist,
  albums,
  tracks,
  artistData,
  coverUrl,
  trackCount,
  albumCount,
  isLoading,
  error,
  isError,
  deleteArtist,
  updateArtist,
  refetch,
  fetchNextTrackPage,
  hasNextTrackPage,
  isTracksLoading,
  isFetchingNextTrackPage,
} = useArtistPage(sortKey);

const showEditDialog = ref(false);
const currentTrackId = computed(() => playerStore.currentTrack?.id ?? null);

function getTrackKey(index: number) {
  return tracks.value[index]?.id ?? index;
}

function handleTrackLoadMore() {
  if (!hasNextTrackPage.value || isFetchingNextTrackPage.value) return;
  fetchNextTrackPage();
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
  openMenu(track, index, { target: "artist" });
}

const errorMessage = computed(() => {
  if (!error.value) return t("errors.unknown");
  const message = error.value.message;
  if (message === "Artist not found") return t("errors.notFound");
  return t("errors.loadFailed");
});

function handlePlayAll() {
  if (!artist.value) return;

  getArtistPageData(artist.value.id, sortKey.value).then((data) => {
    if (data && data.tracks.length > 0) {
      queueStore.setQueue(data.tracks, 0, { type: "artist", artistId: artist.value!.id });
    }
  });
}

async function handlePlayTrack(index: number) {
  if (!artist.value) return;

  const selectedTrack = tracks.value[index];
  if (!selectedTrack) return;

  if (currentTrackId.value === selectedTrack.id) {
    playerStore.togglePlay();
    return;
  }

  const data = await getArtistPageData(artist.value.id, sortKey.value);
  const fullIndex = data.tracks.findIndex(track => track.id === selectedTrack.id);
  if (fullIndex === -1) return;

  await queueStore.setQueue(data.tracks, fullIndex, { type: "artist", artistId: artist.value.id });
}

async function handleShuffle() {
  if (!artist.value) return;

  const source = { type: "artist", artistId: artist.value.id } as const;

  if (queueStore.currentItem && isSameQueueSource(queueStore.currentItem.source, source)) {
    queueStore.toggleShuffle();
    return;
  }

  const data = await getArtistPageData(artist.value.id, sortKey.value);
  if (data.tracks.length === 0) return;

  const randomIndex = getSecureRandomIndex(data.tracks.length);
  await queueStore.setQueue(data.tracks, randomIndex, source, { shuffled: true });
}

function openDeleteDialog() {
  if (!artist.value) return;

  openGlobalDeleteDialog({
    type: "artist",
    id: artist.value.id,
    name: artist.value.name,
    trackCount: trackCount.value,
  }, handleDelete);
}

async function handleDelete() {
  try {
    await deleteArtist();
  }
  catch {
    toast.error(t("artist.deleteFailed"));
  }
}

async function handleSave(changes: ArtistChanges) {
  try {
    await updateArtist(changes);
    showEditDialog.value = false;
  }
  catch (e) {
    const message = e instanceof Error ? e.message : t("errors.loadFailed");
    toast.error(message);
  }
}
</script>
