<template>
  <SettingsGroup class="mt-3">
    <div class="px-4 py-3 font-semibold text-foreground">
      {{ $t("settings.stats.habits") }}
    </div>

    <div class="grid grid-cols-2 gap-2 px-2 pb-2">
      <div
        v-if="peak"
        class="col-span-2 rounded-xl bg-muted p-4"
      >
        <p class="text-base font-semibold text-foreground">
          {{ hourlyTitle }}
        </p>
        <div
          class="mt-3 flex items-end gap-[3px]"
          :style="{ height: `${CHART_HEIGHT}px` }"
          role="img"
          :aria-label="hourlyTitle"
        >
          <div
            v-for="(seconds, hour) in hours"
            :key="hour"
            class="min-w-0 flex-1 rounded-sm"
            :class="barClass(hour, seconds)"
            :style="{ height: `${barHeight(seconds)}px` }"
          />
        </div>
        <div class="mt-1.5 flex text-[10px] leading-none text-muted-foreground tabular-nums">
          <span class="w-1/4">00</span>
          <span class="w-1/4">06</span>
          <span class="w-1/4">12</span>
          <span class="w-1/4">18</span>
        </div>
      </div>

      <StatsCard
        v-if="completionTotal > 0"
        :value="`${completionPercent}%`"
        :caption="$t('settings.stats.completionCaption')"
      >
        <template #media>
          <svg
            class="size-14 -rotate-90"
            viewBox="0 0 36 36"
            aria-hidden="true"
          >
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              class="text-foreground/10"
            />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              class="text-primary transition-[stroke-dashoffset] duration-300"
              :stroke-dasharray="`${RING_LENGTH}`"
              :stroke-dashoffset="`${RING_LENGTH * (1 - completionPercent / 100)}`"
            />
          </svg>
        </template>
      </StatsCard>

      <StatsCard
        :value="$t('settings.stats.streakDays', streaks?.current ?? 0)"
        :caption="$t('settings.stats.streakCaption')"
      >
        <template #media>
          <IconFlame
            class="size-14 text-primary"
            aria-hidden="true"
          />
        </template>
      </StatsCard>

      <div class="col-span-2 rounded-xl bg-muted p-4">
        <p class="text-base font-semibold text-foreground">
          {{ $t("settings.stats.activity") }}
        </p>
        <div
          v-if="isDailyLoading"
          class="mt-2 h-40 animate-pulse rounded-lg bg-background"
        />
        <CalendarHeatmap
          v-else
          :data="dailyActivity ?? []"
        />
      </div>
    </div>
  </SettingsGroup>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import CalendarHeatmap from "@/components/ui/charts/CalendarHeatmap.vue";
import { useDailyActivity, useHourlyActivity, useStatsSummary, useStreaks } from "@/composables/useStatsQueries";
import IconFlame from "~icons/tabler/flame-filled";
import StatsCard from "./StatsCard.vue";

const props = defineProps<{ since?: number }>();

const CHART_HEIGHT = 56;
const PEAK_WINDOW = 4;
const RING_LENGTH = 2 * Math.PI * 15;

const { t } = useI18n();
const { data: hourly } = useHourlyActivity(() => props.since);
const { data: summary } = useStatsSummary(() => props.since);
const { data: streaks } = useStreaks();
const { data: dailyActivity, isLoading: isDailyLoading } = useDailyActivity(365);

const hours = computed(() => hourly.value ?? []);
const maxSeconds = computed(() => Math.max(1, ...hours.value));

const barHeight = (seconds: number): number => {
  if (seconds <= 0) return 2;
  return Math.max(4, Math.round((seconds / maxSeconds.value) * CHART_HEIGHT));
};

// The busiest run of four consecutive hours, wrapping past midnight.
const peak = computed(() => {
  const h = hours.value;
  if (h.length !== 24 || h.every(s => s === 0)) return null;
  let bestStart = 0;
  let bestSum = -1;
  for (let start = 0; start < 24; start++) {
    let sum = 0;
    for (let i = 0; i < PEAK_WINDOW; i++) sum += h[(start + i) % 24];
    if (sum > bestSum) {
      bestSum = sum;
      bestStart = start;
    }
  }
  return { start: bestStart, end: (bestStart + PEAK_WINDOW) % 24 };
});

const isPeakHour = (hour: number): boolean =>
  !!peak.value && (hour - peak.value.start + 24) % 24 < PEAK_WINDOW;

const barClass = (hour: number, seconds: number): string => {
  if (seconds <= 0) return "bg-foreground/10";
  return isPeakHour(hour) ? "bg-primary" : "bg-primary/35";
};

const hourlyKey = (start: number): "hourlyMorning" | "hourlyDay" | "hourlyEvening" | "hourlyNight" => {
  if (start >= 5 && start < 11) return "hourlyMorning";
  if (start >= 11 && start < 17) return "hourlyDay";
  if (start >= 17 && start < 23) return "hourlyEvening";
  return "hourlyNight";
};

const hourlyTitle = computed(() => {
  if (!peak.value) return "";
  const { start, end } = peak.value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return t(`settings.stats.${hourlyKey(start)}`, { range: `${pad(start)}:00–${pad(end)}:00` });
});

const completionTotal = computed(() =>
  (summary.value?.completedCount ?? 0) + (summary.value?.skippedCount ?? 0),
);
const completionPercent = computed(() =>
  completionTotal.value === 0 ? 0 : Math.round(((summary.value?.completedCount ?? 0) / completionTotal.value) * 100),
);
</script>
