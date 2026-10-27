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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import IconChartHistogram from "~icons/tabler/chart-histogram";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import SettingsScreen from "@/modules/settings/components/SettingsScreen.vue";
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

const period = ref<StatsPeriod>("month");
const range = computed(() => periodRange(period.value));
const since = computed(() => range.value.since);

const { data: historyExists } = useQuery(statsQueries.hasHistory());
const hasHistory = computed(() => historyExists.value !== false);
</script>
