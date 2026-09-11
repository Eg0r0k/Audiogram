<template>
  <div class="grid grid-cols-2 gap-2 text-xs">
    <div class="rounded border p-2">
      <div class="text-muted-foreground">
        hit@{{ limit }}
      </div>
      <div class="text-lg tabular-nums">
        {{ (metrics.hit * 100).toFixed(1) }}%
      </div>
      <div
        v-if="hitProgress.done < hitProgress.total"
        class="text-muted-foreground"
      >
        выборка {{ hitProgress.done }}/{{ hitProgress.total }}
      </div>
    </div>
    <div class="rounded border p-2">
      <div class="text-muted-foreground">
        согласие с оценками
      </div>
      <div class="text-lg tabular-nums">
        {{ metrics.agreement === null ? "—" : `${(metrics.agreement * 100).toFixed(1)}%` }}
      </div>
      <div class="text-muted-foreground">
        {{ feedbackCount }} пар · {{ feedbackSources }} источников
      </div>
    </div>
    <div class="rounded border p-2">
      <div class="text-muted-foreground">
        охват top-{{ limit }}
      </div>
      <div class="text-lg tabular-nums">
        {{ metrics.reach }}
      </div>
      <div class="text-muted-foreground">
        разных треков по {{ hitProgress.total }} источникам
      </div>
    </div>
    <div class="rounded border p-2">
      <div class="text-muted-foreground">
        автоплей за 7 дней
      </div>
      <div class="text-lg tabular-nums">
        {{ coverage.autoplay7d }}
      </div>
      <div class="text-muted-foreground">
        разных треков из {{ coverage.library }}
      </div>
    </div>
    <div class="rounded border p-2 tabular-nums">
      <div class="text-muted-foreground">
        разведка за 14 дней
      </div>
      <div>дослушано {{ picks.explore.completed }} из {{ picks.explore.plays }} · ранних скипов {{ picks.explore.earlySkips }}</div>
      <div class="text-muted-foreground">
        ранжирование: {{ picks.rank.completed }} из {{ picks.rank.plays }} · скипов {{ picks.rank.earlySkips }}
      </div>
    </div>
    <div class="rounded border p-2 tabular-nums">
      <div class="text-muted-foreground">
        доля разведочного слота
      </div>
      <div class="text-lg">
        {{ exploreShare.effective.toFixed(2) }}
      </div>
      <div class="text-muted-foreground">
        база {{ exploreShare.base.toFixed(2) }} · {{ exploreShare.effective === exploreShare.base ? "без адаптации" : "адаптирована по дослушиваниям" }}
      </div>
    </div>
    <div class="col-span-2 rounded border p-2 tabular-nums text-muted-foreground">
      контекст {{ timings.contextMs.toFixed(0) }} мс · батч {{ timings.batchMs.toFixed(0) }} мс
    </div>
    <div
      v-if="tuneProgress"
      class="col-span-2 rounded border p-2 text-muted-foreground"
    >
      подбор весов: {{ tuneProgress.done }} / ≤{{ tuneProgress.total }}
      · {{ tuneUsesAgreement ? "цель: hit@N + согласие" : "цель: только hit@N (меньше 20 оценённых пар)" }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ListenPick } from "@/db/entities";
import type { PickStats } from "@/modules/recommendations/lib/explore-policy";
import type { StandCoverage, StandTimings } from "@/modules/recommendations/composables/useRecoStand";

defineProps<{
  metrics: { hit: number; agreement: number | null; reach: number };
  hitProgress: { done: number; total: number };
  tuneProgress: { done: number; total: number } | null;
  tuneUsesAgreement: boolean | null;
  timings: StandTimings;
  feedbackCount: number;
  feedbackSources: number;
  limit: number;
  coverage: StandCoverage;
  picks: Record<ListenPick, PickStats>;
  exploreShare: { base: number; effective: number };
}>();
</script>
