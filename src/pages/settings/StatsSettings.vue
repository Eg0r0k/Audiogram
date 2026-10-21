<template>
  <SettingsScreen :title="$t('settings.stats.title')">
    <template v-if="hasHistory">
      <SettingsGroup class="pb-0">
        <StatsPeriodSwitcher v-model="period" />
      </SettingsGroup>
      <StatsSummary
        :period="period"
        :range="range"
      />
      <StatsRecords :since="since" />
      <StatsHabits :since="since" />
      <StatsTopTracks :since="since" />
      <StatsTopArtists :since="since" />
      <StatsTopGenres :since="since" />

      <SettingsGroup
        v-if="isDev"
        class="mt-3"
      >
        <div class="px-4 py-3">
          <div class="mb-1 font-semibold text-foreground">
            {{ $t("settings.stats.recommender.evalTitle") }}
          </div>
          <div class="text-sm text-muted-foreground">
            {{ $t("settings.stats.recommender.evalSubtitle") }}
          </div>
        </div>
        <Button
          class="w-full h-14 justify-start"
          size="xl"
          variant="ghost"
          @click="handleRecommenderEval"
        >
          <IconFlask class="size-6" />
          {{ $t("settings.stats.recommender.evalTitle") }}
        </Button>
      </SettingsGroup>
    </template>

    <SettingsGroup
      v-else
    >
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <IconChartHistogram class="size-11 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle>{{ $t("settings.stats.empty") }}</EmptyTitle>
          <EmptyDescription>{{ $t("settings.stats.emptySub") }}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </SettingsGroup>
  </SettingsScreen>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { toaster } from "@/app/toaster";
import { useI18n } from "vue-i18n";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import IconChartHistogram from "~icons/tabler/chart-histogram";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import SettingsScreen from "@/modules/settings/components/SettingsScreen.vue";
import IconFlask from "~icons/tabler/flask";
import StatsPeriodSwitcher from "./components/stats/StatsPeriodSwitcher.vue";
import StatsSummary from "./components/stats/StatsSummary.vue";
import StatsTopTracks from "./components/stats/StatsTopTracks.vue";
import StatsTopArtists from "./components/stats/StatsTopArtists.vue";
import StatsRecords from "./components/stats/StatsRecords.vue";
import StatsTopGenres from "./components/stats/StatsTopGenres.vue";
import StatsHabits from "./components/stats/StatsHabits.vue";
import type { StatsPeriod } from "./components/stats/period";
import { periodRange } from "./components/stats/period";
import { statsQueries } from "@/queries/stats.queries";
import { getLogger } from "@/lib/logger";
import { runRecommenderEval } from "@/modules/recommendations/service/recommender-eval.service";

const { t } = useI18n();

const isDev = import.meta.env.DEV;

const period = ref<StatsPeriod>("month");
const range = computed(() => periodRange(period.value));
const since = computed(() => range.value.since);

const { data: historyExists } = useQuery(statsQueries.hasHistory());
const hasHistory = computed(() => historyExists.value !== false);

const handleRecommenderEval = async () => {
  try {
    const report = await runRecommenderEval();
    getLogger().info(`[Recommendations] Eval report: ${JSON.stringify(report)}`);
    const aucValue = report.aucLearned ?? report.aucDefault;
    const auc = aucValue === null ? "—" : aucValue.toFixed(3);
    const rate = report.autoplaySkipRate14d === null ? "—" : (report.autoplaySkipRate14d * 100).toFixed(1);
    toaster.add({ title: t("settings.stats.recommender.evalResult", { auc, rate, n: report.examples }), color: "success" });
  }
  catch (error) {
    getLogger().error(`[Recommendations] Eval failed: ${String(error)}`);
    toaster.add({ title: String(error), color: "destructive" });
  }
};
</script>
