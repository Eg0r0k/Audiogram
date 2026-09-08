<template>
  <SettingsScreen :title="$t('settings.stats.title')">
    <template v-if="hasHistory">
      <SettingsGroup>
        <StatsPeriodSwitcher v-model="period" />
      </SettingsGroup>
      <StatsSummary :since="since" />
      <StatsStreakSection />
      <StatsTopTracks :since="since" />
      <StatsTopArtists :since="since" />

      <StatsCompletionRow :since="since" />
      <StatsHourlyRow :since="since" />

      <StatsRecords :since="since" />
      <StatsTopGenres :since="since" />

      <SettingsGroup class="mt-3">
        <div class="px-4 py-3">
          <div class="mb-1 text-primary font-medium">
            {{ $t("settings.stats.clear") }}
          </div>
          <div class="text-sm text-muted-foreground">
            {{ $t("settings.stats.clearDesc") }}
          </div>
        </div>
        <Button
          class="w-full h-14 justify-start"
          size="xl"
          variant="ghost-primary"
          @click="handleClearHistory"
        >
          <IconTrash class="size-6" />
          {{ $t("settings.stats.clear") }}
        </Button>
      </SettingsGroup>

      <SettingsGroup
        v-if="isDev"
        class="mt-3"
      >
        <div class="px-4 py-3">
          <div class="mb-1 text-primary font-medium">
            {{ $t("settings.stats.recommender.evalTitle") }}
          </div>
          <div class="text-sm text-muted-foreground">
            {{ $t("settings.stats.recommender.evalSubtitle") }}
          </div>
        </div>
        <Button
          class="w-full h-14 justify-start"
          size="xl"
          variant="ghost-primary"
          @click="handleRecommenderEval"
        >
          <IconFlask class="size-6" />
          {{ $t("settings.stats.recommender.evalTitle") }}
        </Button>
      </SettingsGroup>
    </template>

    <SettingsGroup v-else>
      <p class="px-4 py-8 text-center text-sm text-muted-foreground">
        {{ $t("settings.stats.empty") }}
      </p>
    </SettingsGroup>
  </SettingsScreen>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { Button } from "@/components/ui/button";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import SettingsScreen from "@/modules/settings/components/SettingsScreen.vue";
import IconTrash from "~icons/tabler/trash";
import IconFlask from "~icons/tabler/flask";
import StatsPeriodSwitcher from "./components/stats/StatsPeriodSwitcher.vue";
import StatsSummary from "./components/stats/StatsSummary.vue";
import StatsStreakSection from "./components/stats/StatsStreakSection.vue";
import StatsTopTracks from "./components/stats/StatsTopTracks.vue";
import StatsTopArtists from "./components/stats/StatsTopArtists.vue";
import StatsCompletionRow from "./components/stats/StatsCompletionRow.vue";
import StatsHourlyRow from "./components/stats/StatsHourlyRow.vue";
import StatsRecords from "./components/stats/StatsRecords.vue";
import StatsTopGenres from "./components/stats/StatsTopGenres.vue";
import { summonDialog } from "@/components/dialogs/summonDialog";
import type { StatsPeriod } from "./components/stats/period";
import { periodSince } from "./components/stats/period";
import { statsQueries } from "@/queries/stats.queries";
import { statsService } from "@/services/stats.service";
import { getLogger } from "@/lib/logger";
import { runRecommenderEval } from "@/modules/recommendations/service/recommender-eval.service";

const { t } = useI18n();

const isDev = import.meta.env.DEV;

const period = ref<StatsPeriod>("month");
const since = computed(() => periodSince(period.value));

// Есть ли история вообще (за всё время) — иначе показываем пустое состояние.
const { data: allTime } = useQuery(statsQueries.summary(undefined));
const hasHistory = computed(() =>
  allTime.value === undefined
  || allTime.value.totalSeconds > 0
  || allTime.value.playsCount > 0,
);

async function handleClearHistory() {
  const cleared = await summonDialog("clearHistory", {
    clear: async () => {
      try {
        await statsService.clearHistory();
      }
      catch (error) {
        getLogger().error(`[Stats] Clearing listening history failed: ${String(error)}`);
        toast.error(t("errors.unknown"));
        throw error;
      }
    },
  }, { key: "clear-history" });
  if (cleared) toast.success(t("settings.stats.cleared"));
}

const handleRecommenderEval = async () => {
  try {
    const report = await runRecommenderEval();
    getLogger().info(`[Recommendations] Eval report: ${JSON.stringify(report)}`);
    const aucValue = report.aucLearned ?? report.aucDefault;
    const auc = aucValue === null ? "—" : aucValue.toFixed(3);
    const rate = report.autoplaySkipRate14d === null ? "—" : (report.autoplaySkipRate14d * 100).toFixed(1);
    toast.success(t("settings.stats.recommender.evalResult", { auc, rate, n: report.examples }));
  }
  catch (error) {
    getLogger().error(`[Recommendations] Eval failed: ${String(error)}`);
    toast.error(String(error));
  }
};
</script>
