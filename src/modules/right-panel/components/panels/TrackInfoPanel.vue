<template>
  <div class="flex h-full flex-col bg-card">
    <RightPanelHeader
      :title="$t('track.details.title')"
      :description="track.title"
      :show-back="rightPanel.depth > 0"
      @back="handleBack"
      @close="rightPanel.close()"
    />

    <Scrollable class="min-h-0 flex-1">
      <div class="grid gap-6 bg-background">
        <section class="grid gap-3 p-2 bg-card">
          <div class="grid gap-3 sm:grid-cols-1">
            <DetailField
              icon="tabler:music"
              :title="$t('track.details.fields.title')"
              :value="track.title"
            />
            <DetailField
              icon="tabler:microphone-2"
              :title="$t('track.details.fields.artist')"
              :value="track.artist"
            />
            <DetailField
              icon="tabler:disc"
              :title="$t('track.details.fields.album')"
              :value="track.albumName"
            />
            <DetailField
              icon="tabler:clock-hour-4"
              :title="$t('track.details.fields.duration')"
              :value="formattedDuration"
            />
            <DetailField
              icon="tabler:world"
              :title="$t('track.details.fields.source')"
              :value="sourceLabel"
            />
            <DetailField
              v-if="isLibraryTrack(track)"
              icon="tabler:folder"
              :title="$t('track.details.fields.storagePath')"
              :value="track.storagePath"
              class="sm:col-span-2"
            />
          </div>
        </section>

        <section
          v-if="isLibraryTrack(track)"
          class="grid gap-3 p-2 bg-card"
        >
          <div class="grid gap-3 sm:grid-cols-1">
            <DetailField
              icon="tabler:fingerprint"
              :title="$t('track.details.fields.trackId')"
              :value="track.id"
            />
            <DetailField
              icon="tabler:disc"
              :title="$t('track.details.fields.albumId')"
              :value="track.albumId"
            />
            <DetailField
              icon="tabler:users"
              :title="$t('track.details.fields.artistIds')"
              :value="track.artistIds.join(', ')"
              class="sm:col-span-2"
            />
            <DetailField
              icon="tabler:circle-check"
              :title="$t('track.details.fields.state')"
              :value="stateLabel"
            />

            <DetailField
              icon="tabler:file-text"
              :title="$t('track.details.fields.lyricsPath')"
              :value="entity?.lyricsPath"
            />
          </div>

          <Button
            class="w-full h-14 justify-start  "
            size="xl"
            variant="destructive-link"
            @click="handleDelete"
          >
            <TrashIcon class="size-6" />
            {{ $t('common.delete') }}
          </Button>
        </section>
      </div>
    </Scrollable>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import { TrackSource, TrackState } from "@/db/entities";
import { Button } from "@/components/ui/button";
import Scrollable from "@/components/ui/scrollable/Scrollable.vue";
import { formatDuration } from "@/lib/format/time";
import { deleteTrackAndSync, getTrackEntityById } from "@/queries/track.queries";
import { queryKeys } from "@/queries/query-keys";
import { isLibraryTrack, type Track } from "@/modules/player/types";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { useRightPanelStore } from "@/modules/right-panel/store/right-panel.store";
import type { RightPanelTrackInfoPayload } from "@/modules/right-panel/types";
import DetailField from "@/modules/tracks/components/TrackDetailsField.vue";
import RightPanelHeader from "../RightPanelHeader.vue";
import TrashIcon from "~icons/tabler/trash";
const props = defineProps<{
  payload: RightPanelTrackInfoPayload;
}>();

const { t } = useI18n();
const queryClient = useQueryClient();
const queueStore = useQueueStore();
const rightPanel = useRightPanelStore();

const track = computed(() => props.payload.track);
const libraryTrack = computed<Track | null>(() => isLibraryTrack(track.value) ? track.value : null);

const { data: entity } = useQuery({
  queryKey: computed(() =>
    libraryTrack.value ? queryKeys.tracks.detail(libraryTrack.value.id) : ["tracks", "detail", "none"]),
  queryFn: computed(() => {
    const id = libraryTrack.value?.id;
    return id ? () => getTrackEntityById(id) : skipToken;
  }),
});

const { mutateAsync: deleteTrack, isPending: isDeleting } = useMutation({
  mutationFn: (currentTrack: Track) => deleteTrackAndSync(queryClient, currentTrack),
  onError: () => {
    toast.error(t("track.deleteFailed"));
  },
});

const formattedDuration = computed(() => {
  if (isLibraryTrack(track.value)) {
    return formatDuration(track.value.duration);
  }

  return track.value.duration ? formatDuration(track.value.duration) : "—";
});

const sourceLabel = computed(() => {
  if (!isLibraryTrack(track.value)) {
    return track.value.source.type;
  }

  switch (track.value.source) {
    case TrackSource.LOCAL_INTERNAL:
      return t("track.details.values.localInternal");
    case TrackSource.LOCAL_EXTERNAL:
      return t("track.details.values.localExternal");
    case TrackSource.REMOTE_HLS:
      return t("track.details.values.remoteHls");
    default:
      return "—";
  }
});

const stateLabel = computed(() => {
  if (!isLibraryTrack(track.value)) return "—";

  switch (track.value.state) {
    case TrackState.READY:
      return t("track.details.values.ready");
    case TrackState.BROKEN:
      return t("track.details.values.broken");
    default:
      return "—";
  }
});

function handleBack(): void {
  rightPanel.back();
}

async function handleDelete(): Promise<void> {
  if (!libraryTrack.value || isDeleting.value) return;

  const currentTrack = libraryTrack.value;
  const queueItemIds = queueStore.queue
    .filter(item => item.track.id === currentTrack.id)
    .map(item => item.id);

  await deleteTrack(currentTrack);

  if (queueItemIds.length > 0) {
    queueStore.removeMultiple(queueItemIds);
  }

  toast.success(t("track.deleted"));
  rightPanel.close();
}
</script>
