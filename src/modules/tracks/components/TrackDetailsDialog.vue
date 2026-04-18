<template>
  <Dialog
    :open="isOpen"
    @update:open="handleOpenChange"
  >
    <DialogContent class="flex flex-col max-h-[80vh] sm:max-w-2xl gap-0 px-0 overflow-hidden h-full">
      <DialogHeader class="gap-2 pr-10 px-4">
        <DialogTitle>{{ $t("track.details.title") }}</DialogTitle>
        <DialogDescription v-if="track">
          {{ track.title }}
        </DialogDescription>
      </DialogHeader>

      <Scrollable class="min-h-0 flex-1">
        <div
          v-if="track"
          class="grid gap-6 px-4"
        >
          <section class="grid gap-3">
            <h3 class="text-sm font-semibold text-muted-foreground  tracking-wide">
              {{ $t("track.details.sections.playback") }}
            </h3>
            <div class="grid gap-3 sm:grid-cols-2">
              <DetailField
                :label="$t('track.details.fields.title')"
                :value="track.title"
              />
              <DetailField
                :label="$t('track.details.fields.artist')"
                :value="track.artist"
              />
              <DetailField
                :label="$t('track.details.fields.album')"
                :value="track.albumName"
              />
              <DetailField
                :label="$t('track.details.fields.duration')"
                :value="formattedDuration"
              />
              <DetailField
                :label="$t('track.details.fields.source')"
                :value="sourceLabel"
              />
              <DetailField
                :label="$t('track.details.fields.state')"
                :value="stateLabel"
              />
              <DetailField
                :label="$t('track.details.fields.liked')"
                :value="booleanLabel(track.isLiked)"
              />
              <DetailField
                :label="$t('track.details.fields.artistIds')"
                :value="track.artistIds.join(', ')"
              />
              <DetailField
                :label="$t('track.details.fields.albumId')"
                :value="track.albumId"
              />
              <DetailField
                :label="$t('track.details.fields.trackId')"
                :value="track.id"
              />
            </div>
          </section>

          <section class="grid gap-3">
            <h3 class="text-sm font-semibold text-muted-foreground  tracking-wide">
              {{ $t("track.details.sections.storage") }}
            </h3>
            <div class="grid gap-3 sm:grid-cols-2">
              <DetailField
                :label="$t('track.details.fields.storagePath')"
                :value="track.storagePath"
                class="sm:col-span-2"
              />
              <DetailField
                :label="$t('track.details.fields.lyricsPath')"
                :value="entity?.lyricsPath"
              />
              <DetailField
                :label="$t('track.details.fields.fingerprint')"
                :value="entity?.fingerprint"
              />
            </div>
          </section>

          <section class="grid gap-3">
            <h3 class="text-sm font-semibold text-muted-foreground  tracking-wide">
              {{ $t("track.details.sections.metadata") }}
            </h3>
            <div class="grid gap-3 sm:grid-cols-2">
              <DetailField
                :label="$t('track.details.fields.trackNo')"
                :value="entity?.trackNo"
              />
              <DetailField
                :label="$t('track.details.fields.diskNo')"
                :value="entity?.diskNo"
              />
              <DetailField
                :label="$t('track.details.fields.playCount')"
                :value="entity?.playCount"
              />
              <DetailField
                :label="$t('track.details.fields.addedAt')"
                :value="formatDate(entity?.addedAt)"
              />
              <DetailField
                :label="$t('track.details.fields.lastPlayedAt')"
                :value="formatDate(entity?.lastPlayedAt)"
              />
              <DetailField
                :label="$t('track.details.fields.codec')"
                :value="entity?.format.codec"
              />
              <DetailField
                :label="$t('track.details.fields.bitrate')"
                :value="formatBitrate(entity?.format.bitrate)"
              />
              <DetailField
                :label="$t('track.details.fields.sampleRate')"
                :value="formatSampleRate(entity?.format.sampleRate)"
              />
              <DetailField
                :label="$t('track.details.fields.channels')"
                :value="entity?.format.channels"
              />
              <DetailField
                :label="$t('track.details.fields.lossless')"
                :value="booleanLabel(entity?.format.lossless)"
              />
            </div>
          </section>

          <section class="grid gap-3">
            <h3 class="text-sm font-semibold text-muted-foreground  tracking-wide">
              {{ $t("track.details.sections.loudness") }}
            </h3>
            <div class="grid gap-3 sm:grid-cols-2">
              <DetailField
                :label="$t('track.details.fields.integratedLufs')"
                :value="formatLoudness(entity?.integratedLufs)"
              />
              <DetailField
                :label="$t('track.details.fields.truePeakDbtp')"
                :value="formatLoudness(entity?.truePeakDbtp)"
              />
              <DetailField
                :label="$t('track.details.fields.replayGainDb')"
                :value="formatLoudness(entity?.replayGainDb)"
              />
              <DetailField
                :label="$t('track.details.fields.replayPeak')"
                :value="entity?.replayPeak"
              />
            </div>
          </section>
        </div>
      </Scrollable>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import { TrackSource, TrackState } from "@/db/entities";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Scrollable } from "@/components/ui/scrollable";
import { formatDuration } from "@/lib/format/time";
import { useTrackDetailsDialog } from "@/modules/tracks/composables/useTrackDetailsDialog";
import DetailField from "./TrackDetailsField.vue";
import { getTrackEntityById } from "@/queries/track.queries";

const { t, locale } = useI18n();
const { isOpen, activeTrack, closeTrackDetails } = useTrackDetailsDialog();

const track = computed(() => activeTrack.value);

const { data: entity } = useQuery({
  queryKey: computed(() => track.value ? ["tracks", track.value.id, "details"] : ["tracks", "details", "idle"]),
  queryFn: () => getTrackEntityById(track.value!.id),
  enabled: computed(() => !!track.value),
});

const formattedDuration = computed(() => track.value ? formatDuration(track.value.duration) : "—");
const sourceLabel = computed(() => {
  switch (track.value?.source) {
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
  switch (track.value?.state) {
    case TrackState.READY:
      return t("track.details.values.ready");
    case TrackState.BROKEN:
      return t("track.details.values.broken");
    default:
      return "—";
  }
});

function booleanLabel(value?: boolean) {
  if (value === undefined) return "—";
  return value ? t("common.yes") : t("common.no");
}

function formatDate(value?: number) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatBitrate(value?: number) {
  return value ? `${Math.round(value / 1000)} kbps` : "—";
}

function formatSampleRate(value?: number) {
  return value ? `${value} Hz` : "—";
}

function formatLoudness(value?: number) {
  return typeof value === "number" ? value.toFixed(2) : "—";
}

function handleOpenChange(open: boolean) {
  if (!open) {
    closeTrackDetails();
  }
}
</script>
