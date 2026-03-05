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

    <template v-else-if="albumData">
      <MediaHero
        :data="albumData"
        @play="handlePlayAll"
        @edit="showEditDialog = true"
        @delete="showDeleteDialog = true"
        @add-to-queue="handleAddToQueue"
        @share="handleShare"
      />

      <TrackContextMenu
        context="album"
        :album-id="album?.id"
      >
        <div class="px-4">
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
import { useAlbumPage } from "@/modules/albums/composables/useAlbumPage";
import DeleteAlbumDialog from "@/modules/albums/components/dialogs/DeleteAlbumDialog.vue";
import EditAlbumDialog from "@/modules/albums/components/dialogs/EditAlbumDialog.vue";

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
  isLoading,
  isError,
  error,
  deleteAlbum,
  updateAlbum,
  refetch,
} = useAlbumPage();

const showDeleteDialog = ref(false);
const showEditDialog = ref(false);
const isSaving = ref(false);

const errorMessage = computed(() => {
  if (!error.value) return t("errors.unknown");

  const message = error.value.message;

  if (message === "Album not found") {
    return t("errors.notFound");
  }

  return t("errors.loadFailed");
});

function handlePlayAll() {
  if (tracks.value.length === 0 || !album.value) return;
  queueStore.setQueue(tracks.value, 0, {
    type: "album",
    albumId: album.value.id,
  });
}

function handlePlayTrack(index: number) {
  if (!album.value) return;
  queueStore.setQueue(tracks.value, index, {
    type: "album",
    albumId: album.value.id,
  });
}

function handleAddToQueue() {
  if (tracks.value.length === 0) return;
  queueStore.addToQueue(tracks.value);
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
  if (isSaving.value) return;

  isSaving.value = true;

  try {
    await updateAlbum(changes);
    showEditDialog.value = false;
  }
  catch (e) {
    const message = e instanceof Error ? e.message : t("album.updateFailed");
    toast.error(message);
  }
  finally {
    isSaving.value = false;
  }
}
</script>
