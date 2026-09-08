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
    <div class="col-span-2 rounded border p-2 tabular-nums text-muted-foreground">
      контекст {{ timings.contextMs.toFixed(0) }} мс · компоненты {{ timings.componentsMs.toFixed(0) }} мс · скоринг {{ timings.scoringMs.toFixed(1) }} мс
      <span v-if="candidates !== null"> · кандидатов {{ candidates }}</span>
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
import type { StandTimings } from "@/modules/recommendations/composables/useRecoStand";

defineProps<{
  metrics: { hit: number; agreement: number | null };
  hitProgress: { done: number; total: number };
  tuneProgress: { done: number; total: number } | null;
  tuneUsesAgreement: boolean | null;
  timings: StandTimings;
  feedbackCount: number;
  feedbackSources: number;
  limit: number;
  candidates: number | null;
}>();
</script>
