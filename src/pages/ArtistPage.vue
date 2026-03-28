<template>
  <Scrollable class="flex-1">
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
      <MediaHero
        :data="artistData"
        @play="handlePlayAll"
        @edit="showEditDialog = true"
        @delete="showDeleteDialog = true"
      />

      <section
        v-if="albums.length > 0"
        class="px-4 py-6"
      >
        <h2 class="text-2xl ml-3 mb-2 font-bold">
          Альбомы
        </h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          <MediaCard
            v-for="album in albums"
            :key="album.id"
            :title="album.title"
            :subtitle="album.year?.toString()"
            :cover-path="album.coverPath"
            :to="{ name: 'album', params: { id: album.id } }"
            :source="{ type: 'album', albumId: album.id }"
            @play="handlePlayAlbum(album.id)"
          />
        </div>
      </section>

      <section
        v-if="tracks.length > 0"
        class="px-4 pb-6"
      >
        <h2 class="text-lg font-semibold mb-4">
          {{ $t("artist.tracks") }}
        </h2>
        <TrackContextMenu context="artist-page">
          <div>
            <TrackRow
              v-for="(track, index) in tracks"
              :key="track.id"
              :compact="isCompact"
              :track="track"
              :index="index + 1"
              @play="handlePlayTrack(index)"
            />
          </div>
        </TrackContextMenu>
        <TrackDropdown context="artist-page" />
      </section>
    </template>

    <!-- <DeleteArtistDialog
      v-model:open="showDeleteDialog"
      :artist="artist"
      :album-count="albums.length"
      :track-count="tracks.length"
      @confirm="handleDelete"
    /> -->
  </Scrollable>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import MediaHero from "@/components/media-hero/MediaHero.vue";
import Scrollable from "@/components/ui/scrollable/Scrollable.vue";
import { Button } from "@/components/ui/button";
import { useLibraryView } from "@/composables/useLibraryView";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import TrackContextMenu from "@/modules/tracks/components/menu/context-menu/TrackContextMenu.vue";
import TrackDropdown from "@/modules/tracks/components/menu/dropdown/TrackDropdown.vue";
import TrackRow from "@/modules/tracks/components/TrackRow.vue";
import DeleteArtistDialog from "@/modules/artists/components/dialogs/DeleteArtistDialog.vue";
import IconLoader2 from "~icons/tabler/loader-2";
import { useArtistPage } from "@/modules/artists/composables/useArtistPage";
import type { ArtistEntity } from "@/db/entities";
import MediaCard from "@/components/media-hero/MediaCard.vue";
import { AlbumId } from "@/types/ids";

const { t } = useI18n();
const { isCompact } = useLibraryView();
const queueStore = useQueueStore();

const {
  artist,
  albums,
  tracks,
  artistData,
  isLoading,
  error,
  isError,
  deleteArtist,
  updateArtist,
  refetch,
} = useArtistPage();

const showDeleteDialog = ref(false);
const showEditDialog = ref(false);

const errorMessage = computed(() => {
  if (!error.value) return t("errors.unknown");
  const message = error.value.message;
  if (message === "Artist not found") return t("errors.notFound");
  return t("errors.loadFailed");
});

function handlePlayAll() {
  if (tracks.value.length === 0 || !artist.value) return;
  queueStore.setQueue(tracks.value, 0, { type: "artist", artistId: artist.value.id });
}

function handlePlayAlbum(albumId: string) {
  const albumTracks = tracks.value.filter(t => t.albumId === albumId);
  if (albumTracks.length === 0 || !artist.value) return;
  queueStore.setQueue(albumTracks, 0, { type: "album", albumId: AlbumId(albumId) });
}

function handlePlayTrack(index: number) {
  if (!artist.value) return;
  queueStore.setQueue(tracks.value, index, { type: "artist", artistId: artist.value.id });
}

async function handleDelete() {
  try {
    await deleteArtist();
    showDeleteDialog.value = false;
  }
  catch {
    // noop
  }
}

async function handleSave(changes: Partial<ArtistEntity>) {
  try {
    await updateArtist(changes);
    showEditDialog.value = false;
  }
  catch {
    // noop

  }
}
</script>
