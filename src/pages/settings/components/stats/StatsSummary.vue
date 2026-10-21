<template>
  <SettingsGroup class="mt-3">
    <div class="px-4 py-3">
      <div
        v-if="isLoading"
        class="h-28 animate-pulse rounded-lg bg-muted"
      />
      <template v-else>
        <p class="text-sm text-muted-foreground">
          {{ heading }}
        </p>
        <p class="mt-1 flex flex-wrap items-baseline gap-x-2 font-bold tabular-nums">
          <span class="text-4xl">{{ amount.primary }}</span>
          <span
            v-if="amount.secondary"
            class="text-2xl text-foreground/80"
          >{{ amount.secondary }}</span>
        </p>
        <p class="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
          <span>{{ t("settings.stats.playsTotal", summary?.playsCount ?? 0) }}</span>
          <span aria-hidden="true">·</span>
          <span>{{ t("settings.stats.artistsTotal", summary?.uniqueArtists ?? 0) }}</span>
        </p>
        <p
          v-if="comparisonText"
          class="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <component
            :is="comparisonIcon"
            class="size-4 shrink-0"
            :class="{ 'text-primary': comparison?.direction === 'more' }"
            aria-hidden="true"
          />
          {{ comparisonText }}
        </p>
      </template>
    </div>
  </SettingsGroup>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import { usePeriodTotal, useStatsSummary } from "@/composables/useStatsQueries";
import IconArrowDown from "~icons/tabler/arrow-down";
import IconArrowUp from "~icons/tabler/arrow-up";
import IconEqual from "~icons/tabler/equal";
import { comparePeriods, type PeriodRange, type StatsPeriod } from "./period";

const props = defineProps<{
  period: StatsPeriod;
  range: PeriodRange;
}>();

const { t, locale } = useI18n();
const { data: summary, isLoading } = useStatsSummary(() => props.range.since);
const { data: previousSeconds } = usePeriodTotal(() => props.range.previous);

const monthName = (time: number) => new Intl.DateTimeFormat(locale.value, { month: "long" }).format(time);
const yearOf = (time: number) => new Date(time).getFullYear();

const heading = computed(() => {
  const since = props.range.since;
  if (since === undefined) return t("settings.stats.listenedAll");
  switch (props.period) {
    case "week": return t("settings.stats.listenedWeek");
    case "month": return t("settings.stats.listenedMonth", { month: monthName(since) });
    default: return t("settings.stats.listenedYear", { year: yearOf(since) });
  }
});

// Hours lead in the big type; minutes follow a size down. Under an hour the
// minutes take the lead themselves.
const amount = computed(() => {
  const total = summary.value?.totalSeconds ?? 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours === 0) return { primary: t("common.minutesShort", { count: minutes }), secondary: null };
  return {
    primary: t("common.hoursShort", { count: hours }),
    secondary: minutes > 0 ? t("common.minutesShort", { count: minutes }) : null,
  };
});

const comparison = computed(() =>
  props.range.previous ? comparePeriods(summary.value?.totalSeconds ?? 0, previousSeconds.value ?? 0) : null,
);

const previousLabel = computed(() => {
  const from = props.range.previous?.from;
  if (from === undefined) return "";
  switch (props.period) {
    case "week": return t("settings.stats.lastWeek");
    case "month": return monthName(from);
    default: return t("settings.stats.yearName", { year: yearOf(from) });
  }
});

const comparisonText = computed(() => {
  const value = comparison.value;
  if (!value) return null;
  const params = { percent: value.percent, prev: previousLabel.value };
  switch (value.direction) {
    case "more": return t("settings.stats.compareMore", params);
    case "less": return t("settings.stats.compareLess", params);
    default: return t("settings.stats.compareSame", params);
  }
});

const comparisonIcon = computed(() => {
  switch (comparison.value?.direction) {
    case "more": return IconArrowUp;
    case "less": return IconArrowDown;
    default: return IconEqual;
  }
});
</script>
