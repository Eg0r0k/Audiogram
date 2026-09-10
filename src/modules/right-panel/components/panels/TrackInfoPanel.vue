<template>
  <div class="flex h-full flex-col bg-card">
    <RightPanelHeader
      :title="$t('track.details.title')"
      :description="track.title"
      :show-back="rightPanel.depth > 0"
      @back="handleBack"
      @close="rightPanel.close()"
    >
      <template #trailing>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              size="icon"
              class="rounded-full"
              variant="ghost"
            >
              <IconDots class="size-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="left"
            align="start"
          >
            <DropdownMenuItem @click="openEdit">
              <IconPencil class="size-5" />
              {{ $t('common.edit') }}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              @click="handleDelete"
            >
              <TrashIcon class="size-5" />
              {{ $t('common.delete') }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </template>
    </RightPanelHeader>

    <Scrollable class="min-h-0 flex-1">
      <div class="grid gap-6 bg-canvas">
        <section class="grid gap-3 p-2 bg-card">
          <div class="grid gap-3 sm:grid-cols-1">
            <DetailField
              :title="$t('track.details.fields.title')"
              :value="track.title"
              @click="openEdit"
            >
              <template #icon>
                <IconMusic class="size-6" />
              </template>
            </DetailField>
            <DetailField
              :title="$t('track.details.fields.artist')"
              :value="track.artist"
              @click="openEdit"
            >
              <template #icon>
                <IconMicrophone2 class="size-6" />
              </template>
            </DetailField>
            <DetailField
              :title="$t('track.details.fields.album')"
              :value="track.albumName"
              @click="openEdit"
            >
              <template #icon>
                <IconDisc class="size-6" />
              </template>
            </DetailField>
            <DetailField
              :title="$t('track.details.fields.duration')"
              :value="formattedDuration"
            >
              <template #icon>
                <IconClockHour4 class="size-6" />
              </template>
            </DetailField>
            <DetailField
              :title="$t('track.details.fields.source')"
              :value="sourceLabel"
            >
              <template #icon>
                <IconWorld class="size-6" />
              </template>
            </DetailField>
            <DetailField
              :title="$t('track.details.fields.storagePath')"
              :value="storagePathValue"
              class="sm:col-span-2"
            >
              <template #icon>
                <IconFolder class="size-6" />
              </template>
            </DetailField>
          </div>
        </section>
        <section
          class="grid gap-3 p-2 bg-card"
        >
          <div class="grid gap-3 sm:grid-cols-1">
            <DetailField
              :title="$t('track.details.fields.codec')"
              :value="effectiveFormat.codec"
            >
              <template #icon>
                <IconFileMusic class="size-6" />
              </template>
            </DetailField>

            <DetailField
              :title="$t('track.details.fields.bitrate')"
              :value="formattedBitrate"
            >
              <template #icon>
                <IconWaveSine class="size-6" />
              </template>
            </DetailField>

            <DetailField
              :title="$t('track.details.fields.sampleRate')"
              :value="formattedSampleRate"
            >
              <template #icon>
                <IconActivityHeartbeat class="size-6" />
              </template>
            </DetailField>

            <DetailField
              :title="$t('track.details.fields.channels')"
              :value="effectiveFormat.channels"
            >
              <template #icon>
                <IconCirclesRelation class="size-6" />
              </template>
            </DetailField>

            <DetailField
              :title="$t('track.details.fields.lossless')"
              :value="losslessLabel"
            >
              <template #icon>
                <IconShieldCheck class="size-6" />
              </template>
            </DetailField>
          </div>
        </section>
        <section
          class="grid gap-3 p-2 bg-card"
        >
          <div class="grid gap-3 sm:grid-cols-1">
            <DetailField
              :title="$t('track.details.fields.trackId')"
              :value="track.id"
            >
              <template #icon>
                <IconFingerprint class="size-6" />
              </template>
            </DetailField>
            <DetailField
              :title="$t('track.details.fields.albumId')"
              :value="track.albumId"
            >
              <template #icon>
                <IconDisc class="size-6" />
              </template>
            </DetailField>
            <DetailField
              :title="$t('track.details.fields.artistIds')"
              :value="track.artistIds.join(', ')"
              class="sm:col-span-2"
            >
              <template #icon>
                <IconUsers class="size-6" />
              </template>
            </DetailField>
            <DetailField
              :title="$t('track.details.fields.state')"
              :value="stateLabel"
            >
              <template #icon>
                <IconCircleCheck class="size-6" />
              </template>
            </DetailField>

            <DetailField
              :title="$t('track.details.fields.lyricsPath')"
              :value="entity?.lyricsPath"
            >
              <template #icon>
                <IconFileText class="size-6" />
              </template>
            </DetailField>
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
import { computed, ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import Scrollable from "@/components/ui/scrollable/Scrollable.vue";
import { formatDuration } from "@/lib/format/time";
import { formatBitrate, formatSampleRate } from "@/lib/format/audio";
import { getLogger } from "@/lib/logger";
import { trackQueries } from "@/queries/track.queries";
import { useTrackDeletion } from "@/modules/tracks/composables/useTrackDeletion";
import { offlineCopyQueries } from "@/queries/offlineCopy.queries";
import type { Track } from "@/modules/player/types";
import { isRemoteTrack } from "@/modules/tracks/lib/trackPredicates";
import { resolveTrackFormat, trackSourceLabelKey, trackStateLabelKey } from "@/modules/tracks/lib/trackDetails";
import { mapTrackEntityToPlayerTrack } from "@/modules/player/utils/trackEntity";
import { useRightPanelStore } from "@/modules/right-panel/store/right-panel.store";
import type { RightPanelTrackInfoPayload } from "@/modules/right-panel/types";
import DetailField from "@/modules/tracks/components/TrackDetailsField.vue";
import RightPanelHeader from "../RightPanelHeader.vue";
import IconCircleCheck from "~icons/tabler/circle-check";
import IconActivityHeartbeat from "~icons/tabler/activity-heartbeat";
import IconClockHour4 from "~icons/tabler/clock-hour-4";
import IconCirclesRelation from "~icons/tabler/circles-relation";
import IconDisc from "~icons/tabler/disc";
import IconFileMusic from "~icons/tabler/file-music";
import IconFileText from "~icons/tabler/file-text";
import IconFingerprint from "~icons/tabler/fingerprint";
import IconFolder from "~icons/tabler/folder";
import IconMicrophone2 from "~icons/tabler/microphone-2";
import IconMusic from "~icons/tabler/music";
import IconPencil from "~icons/tabler/pencil";
import IconDots from "~icons/tabler/dots";
import IconShieldCheck from "~icons/tabler/shield-check";
import TrashIcon from "~icons/tabler/trash";
import IconUsers from "~icons/tabler/users";
import IconWaveSine from "~icons/tabler/wave-sine";
import IconWorld from "~icons/tabler/world";
import DropdownMenu from "@/components/ui/dropdown-menu/DropdownMenu.vue";
import DropdownMenuTrigger from "@/components/ui/dropdown-menu/DropdownMenuTrigger.vue";
import DropdownMenuContent from "@/components/ui/dropdown-menu/DropdownMenuContent.vue";
import DropdownMenuItem from "@/components/ui/dropdown-menu/DropdownMenuItem.vue";
const props = defineProps<{
  payload: RightPanelTrackInfoPayload;
}>();

const { t } = useI18n();
const rightPanel = useRightPanelStore();

const payloadTrack = computed(() => props.payload.track);

const { data: entity } = useQuery(computed(() => trackQueries.detail(payloadTrack.value.id)));

const track = computed<Track>(() =>
  entity.value ? mapTrackEntityToPlayerTrack(entity.value) : payloadTrack.value);

const { data: offlineCopy } = useQuery(computed(() =>
  offlineCopyQueries.detail(isRemoteTrack(track.value) ? track.value.id : null),
));

const storagePathValue = computed(() =>
  track.value.storagePath || offlineCopy.value?.storagePath || "—",
);

const { confirmDeletion, deleteWithUndo } = useTrackDeletion();
const isDeleting = ref(false);

const formattedDuration = computed(() => formatDuration(track.value.duration));

function openEdit() {
  rightPanel.openEditTrack({ track: track.value });
}

const labelOr = (key: string | null) => (key ? t(key) : "—");
const sourceLabel = computed(() => labelOr(trackSourceLabelKey(track.value.source)));
const stateLabel = computed(() => labelOr(trackStateLabelKey(track.value.state)));

const effectiveFormat = computed(() => resolveTrackFormat(entity.value?.format, offlineCopy.value?.format));

const formattedBitrate = computed(() => formatBitrate(effectiveFormat.value.bitrate));
const formattedSampleRate = computed(() => formatSampleRate(effectiveFormat.value.sampleRate));

const losslessLabel = computed(() => {
  const lossless = effectiveFormat.value.lossless;
  if (lossless === undefined) return "—";
  return lossless ? t("common.yes") : t("common.no");
});

function handleBack(): void {
  rightPanel.back();
}

async function handleDelete(): Promise<void> {
  if (isDeleting.value) return;
  if (!(await confirmDeletion([track.value.id], track.value.title))) return;
  await performDelete();
}

async function performDelete(): Promise<void> {
  if (isDeleting.value) return;

  isDeleting.value = true;
  try {
    const deleted = await deleteWithUndo([track.value.id], () => t("track.deleted"));
    if (deleted === 0) throw new Error("Track not found");
    rightPanel.close();
  }
  catch (error) {
    getLogger().error(`[TrackInfoPanel] Deleting the track failed: ${String(error)}`);
    toast.error(t("track.deleteFailed"));
  }
  finally {
    isDeleting.value = false;
  }
}
</script>
