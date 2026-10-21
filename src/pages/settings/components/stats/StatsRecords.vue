<template>
  <SettingsGroup
    v-if="records && (records.busiestDay || repeatTrack || records.longestSessionSeconds > 0)"
    class="mt-3"
  >
    <div class="px-4 py-3 font-semibold text-foreground">
      {{ $t("settings.stats.records") }}
    </div>

    <div class="grid grid-cols-2 gap-2 px-2 pb-2">
      <StatsCard
        v-if="records.busiestDay"
        :label="$t('settings.stats.recordBestDay')"
        :value="formatTotalDuration(records.busiestDay.seconds, t)"
        :caption="busiestDayLabel"
      />
      <StatsCard
        v-if="records.longestSessionSeconds > 0"
        :label="$t('settings.stats.recordLongestSession')"
        :value="formatTotalDuration(records.longestSessionSeconds, t)"
        :caption="$t('settings.stats.withoutBreak')"
      />
      <StatsCard
        v-if="repeatTrack"
        class="col-span-2"
        :label="$t('settings.stats.recordOnRepeat')"
        :value="repeatTrack.title"
        :caption="`${repeatTrack.artistName} · ${$t('settings.stats.playsCount', records.mostRepeatedCount)}`"
      />
    </div>
  </SettingsGroup>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useQuery } from "@tanstack/vue-query";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import { useStatsRecords } from "@/composables/useStatsQueries";
import { statsQueries } from "@/queries/stats.queries";
import { formatTotalDuration } from "@/lib/format/time";
import StatsCard from "./StatsCard.vue";

const props = defineProps<{ since?: number }>();

const { t, locale } = useI18n();
const { data: records } = useStatsRecords(() => props.since);

const repeatIds = computed(() =>
  records.value?.mostRepeatedTrackId ? [records.value.mostRepeatedTrackId] : [],
);
const { data: repeatTracks } = useQuery(
  computed(() => ({
    ...statsQueries.topTracksMeta(repeatIds.value),
    enabled: repeatIds.value.length > 0,
  })),
);
const repeatTrack = computed(() => repeatTracks.value?.[0] ?? null);

const busiestDayLabel = computed(() => {
  const day = records.value?.busiestDay;
  if (!day) return "";
  // day.date is a local "YYYY-MM-DD" key; T00:00:00 parses as local midnight.
  return new Intl.DateTimeFormat(locale.value, { day: "numeric", month: "long" })
    .format(new Date(`${day.date}T00:00:00`));
});
</script>
