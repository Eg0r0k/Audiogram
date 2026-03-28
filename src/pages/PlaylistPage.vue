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

    <template v-else-if="playlistData">
      <MediaHero
        :data="playlistData"
        @play="handlePlayAll"
        @edit="showEditDialog = true"
        @delete="showDeleteDialog = true"
        @add-to-queue="handleAddToQueue"
        @share="handleShare"
      />

      <TrackContextMenu
        context="playlist"
        :playlist-id="playlist?.id"
        :is-playlist-owner="true"
      >
        <div class="px-4 mt-4">
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

      <TrackDropdown
        context="playlist"
        :playlist-id="playlist?.id"
        :is-playlist-owner="true"
      />
    </template>

    <DeletePlaylistDialog
      v-model:open="showDeleteDialog"
      :playlist="playlist"
      :track-count="tracks.length"
      @confirm="handleDelete"
    />

    <EditPlaylistDialog
      v-model:open="showEditDialog"
      :playlist="playlist"
      :current-cover-url="coverUrl"
      @save="handleSave"
    />
  </Scrollable>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import MediaHero from "@/components/media-hero/MediaHero.vue";
import Scrollable from "@/components/ui/scrollable/Scrollable.vue";
import { Button } from "@/components/ui/button";
import { useLibraryView } from "@/composables/useLibraryView";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import TrackContextMenu from "@/modules/tracks/components/menu/context-menu/TrackContextMenu.vue";
import TrackDropdown from "@/modules/tracks/components/menu/dropdown/TrackDropdown.vue";
import TrackRow from "@/modules/tracks/components/TrackRow.vue";
import IconLoader2 from "~icons/tabler/loader-2";
import { PlaylistChanges, usePlaylistPage } from "@/modules/playlist/composables/usePlaylistPage";
import DeletePlaylistDialog from "@/modules/playlist/components/dialogs/DeletePlaylistDialog.vue";
import EditPlaylistDialog from "@/modules/playlist/components/dialogs/EditPlaylistDialog.vue";

const { t } = useI18n();
const { isCompact } = useLibraryView();
const queueStore = useQueueStore();

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
} = usePlaylistPage();

const showDeleteDialog = ref(false);
const showEditDialog = ref(false);

const errorMessage = computed(() => {
  if (!error.value) return t("errors.unknown");
  if (error.value.message === "Playlist not found") return t("errors.notFound");
  return t("errors.loadFailed");
});

function handlePlayAll() {
  if (tracks.value.length === 0 || !playlist.value) return;
  queueStore.setQueue(tracks.value, 0, {
    type: "playlist",
    playlistId: playlist.value.id,
  });
}

function handlePlayTrack(index: number) {
  if (!playlist.value) return;
  queueStore.setQueue(tracks.value, index, {
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

async function handleDelete() {
  try {
    await deletePlaylist();
    showDeleteDialog.value = false;
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
