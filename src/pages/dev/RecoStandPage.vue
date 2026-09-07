<template>
  <div class="grid h-full grid-cols-[300px_minmax(0,1fr)_340px] gap-4 overflow-hidden p-4">
    <aside class="overflow-auto">
      <StandSourcePicker
        :source="sourceTrack"
        :search="searchTracks"
        @select="setSource"
        @pick-current="pickCurrent"
        @pick-random="pickRandomFromHistory"
      />
    </aside>

    <main class="overflow-auto">
      <p
        v-if="isLoading"
        class="px-3 py-8 text-center text-sm text-muted-foreground"
      >
        Загрузка базы…
      </p>
      <StandCandidateList
        v-else
        :rows="rows"
        :weights="weights"
        :source-id="sourceId"
        :step="params.limit"
        @rate="onRate"
        @play="play"
        @more="extraRows += params.limit"
      />
    </main>

    <aside class="flex flex-col gap-4 overflow-auto">
      <StandMetrics
        :metrics="metrics"
        :hit-progress="hitProgress"
        :tune-progress="tuneProgress"
        :timings="timings"
        :feedback-count="feedbackCount"
        :feedback-sources="feedbackSources"
        :limit="params.limit"
        :candidates="candidateCount"
        :tune-uses-agreement="tuneUsesAgreement"
      />
      <StandControls
        :weights="weights"
        :params="params"
        :tuning="tuneProgress !== null"
        @reset="resetWeights"
        @tune="tune"
        @copy="onCopy"
        @reload="reload"
        @export="onExport"
        @update:weight="onUpdateWeight"
        @update:param="onUpdateParam"
      />
    </aside>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { toast } from "vue-sonner";
import { getLogger } from "@/lib/logger";
import type { SignalKey } from "@/modules/recommendations/service/signals";
import type { ScoringParams } from "@/modules/recommendations/service/scoring";
import type { FeedbackLabel } from "@/modules/recommendations/service/stand-feedback.store";
import type { TrackId } from "@/types/ids";
import { useRecoStand } from "@/modules/recommendations/composables/useRecoStand";
import StandSourcePicker from "@/modules/recommendations/components/stand/StandSourcePicker.vue";
import StandCandidateList from "@/modules/recommendations/components/stand/StandCandidateList.vue";
import StandControls from "@/modules/recommendations/components/stand/StandControls.vue";
import StandMetrics from "@/modules/recommendations/components/stand/StandMetrics.vue";

const stand = useRecoStand();
const {
  isLoading, sourceId, sourceTrack, weights, params, extraRows, rows, timings,
  feedbackCount, feedbackSources, metrics, hitProgress, tuneProgress, tuneUsesAgreement, candidateCount,
  load, reload, setSource, pickCurrent, pickRandomFromHistory, searchTracks,
  rate, play, resetWeights, tune, copyWeightsJson, exportSnapshot,
} = stand;

const onCopy = async () => {
  await copyWeightsJson();
  toast.success("Веса скопированы");
};

const onExport = async () => {
  const file = await exportSnapshot();
  if (!file) {
    toast.error("Нет данных для снимка");
    return;
  }
  toast.success(`Снимок записан: ${file}`);
};

const onRate = async (id: TrackId, label: FeedbackLabel) => {
  try {
    await rate(id, label);
  }
  catch (error) {
    toast.error(`Не удалось сохранить оценку: ${String(error)}`);
  }
};

const onUpdateWeight = (key: SignalKey, value: number) => {
  weights[key] = value;
};

const onUpdateParam = (key: keyof ScoringParams, value: number) => {
  params[key] = value;
};

onMounted(() => {
  load().catch(error => getLogger().error(`[RecoStandPage] Load failed: ${String(error)}`));
});
</script>
