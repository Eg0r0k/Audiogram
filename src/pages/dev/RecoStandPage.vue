<template>
  <div class="grid h-full grid-cols-[300px_minmax(0,1fr)_340px] gap-4 overflow-hidden p-4">
    <aside class="overflow-auto">
      <StandSourcePicker
        :source="seedTrack"
        :search="searchTracks"
        @select="id => run(() => startFeed(id))"
        @pick-current="pickCurrent"
        @pick-random="pickRandomFromHistory"
      />
    </aside>

    <main class="flex flex-col gap-4 overflow-auto">
      <StandHint />
      <p
        v-if="isLoading"
        class="px-3 py-8 text-center text-sm text-muted-foreground"
      >
        Загрузка базы…
      </p>
      <StandFeed
        v-else
        :split="feedSplit"
        :weights="weights"
        :active="feedActive"
        :started="feedStarted"
        :title-of="titleOf"
        @like="run(likeCurrent)"
        @dislike="run(dislikeCurrent)"
        @skip="run(skipCurrent)"
        @rebuild="run(rebuildUpcoming)"
        @rate="onRate"
        @jump="id => run(() => jumpTo(id))"
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
        :tune-uses-agreement="tuneUsesAgreement"
        :coverage="coverage"
        :picks="pickStats"
        :explore-share="{ base: params.exploreShare, effective: effectiveShare }"
      />
      <StandLegend />
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
import { onKeyStroke } from "@vueuse/core";
import { reportError } from "@/app/error-feedback";
import { toaster } from "@/app/toaster";
import { formatError } from "@/lib/errors";
import { getLogger } from "@/lib/logger";
import type { ComponentKey } from "@/modules/recommendations/lib/scoring";
import type { FeedbackLabel } from "@/modules/recommendations/service/standFeedbackStorage";
import type { TrackId } from "@/types/ids";
import { useRecoStand, type StandParams } from "@/modules/recommendations/composables/useRecoStand";
import StandSourcePicker from "@/modules/recommendations/components/stand/StandSourcePicker.vue";
import StandFeed from "@/modules/recommendations/components/stand/StandFeed.vue";
import StandControls from "@/modules/recommendations/components/stand/StandControls.vue";
import StandMetrics from "@/modules/recommendations/components/stand/StandMetrics.vue";
import StandLegend from "@/modules/recommendations/components/stand/StandLegend.vue";
import StandHint from "@/modules/recommendations/components/stand/StandHint.vue";

const stand = useRecoStand();
const {
  ctx, isLoading, seedTrack, weights, params, timings,
  feedSplit, feedActive, feedStarted,
  feedbackCount, feedbackSources, metrics, hitProgress, tuneProgress, tuneUsesAgreement,
  effectiveShare, pickStats, coverage,
  load, reload, startFeed, pickCurrent, pickRandomFromHistory, searchTracks,
  rate, likeCurrent, dislikeCurrent, skipCurrent, jumpTo, rebuildUpcoming,
  resetWeights, tune, copyWeightsJson, exportSnapshot,
} = stand;

const titleOf = (id: TrackId | null) => (id && ctx.value?.tracks.get(id)?.title) ?? "";

const run = (action: () => Promise<void>) => {
  action().catch(error => reportError(error, { title: "Действие не выполнено", scope: "RecoStand" }));
};

const onCopy = async () => {
  await copyWeightsJson();
  toaster.add({ title: "Веса скопированы", color: "success" });
};

const onExport = async () => {
  const file = await exportSnapshot();
  if (!file) {
    toaster.add({ title: "Нет данных для снимка", color: "warning" });
    return;
  }
  toaster.add({ title: `Снимок записан: ${file}`, color: "success" });
};

const onRate = async (id: TrackId, label: FeedbackLabel) => {
  try {
    await rate(id, label);
  }
  catch (error) {
    reportError(error, { title: "Не удалось сохранить оценку", scope: "RecoStand" });
  }
};

const onUpdateWeight = (key: ComponentKey, value: number) => {
  weights[key] = value;
};

const onUpdateParam = (key: keyof StandParams, value: number) => {
  params[key] = value;
};

const EDITABLE_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA"]);
const hotkey = (action: () => Promise<void>) => (e: KeyboardEvent) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const el = document.activeElement;
  if (el && (EDITABLE_TAGS.has(el.tagName) || (el as HTMLElement).isContentEditable)) return;
  if (!feedActive.value) return;
  e.preventDefault();
  run(action);
};
onKeyStroke(["d", "D", "в", "В"], hotkey(dislikeCurrent));
onKeyStroke(["l", "L", "д", "Д"], hotkey(likeCurrent));
onKeyStroke(["n", "N", "т", "Т"], hotkey(skipCurrent));

onMounted(() => {
  load().catch(error => getLogger().error(`[RecoStandPage] Load failed: ${formatError(error)}`));
});
</script>
