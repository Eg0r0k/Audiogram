<template>
  <div
    class="flex w-full overflow-hidden rounded bg-muted"
    :class="thick ? 'h-3' : 'h-1.5'"
  >
    <div
      v-for="seg in segments"
      :key="seg.key"
      :title="seg.title"
      :style="{ width: `${seg.width}%`, background: seg.color, opacity: seg.negative ? 0.4 : 1 }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { COMPONENT_KEYS, type Breakdown, type ComponentWeights } from "@/modules/recommendations/lib/scoring";
import { COMPONENT_COLORS, type StandBarKey } from "@/modules/recommendations/service/stand-signal-meta";

const props = defineProps<{ breakdown: Breakdown; weights: ComponentWeights; thick?: boolean }>();

interface Segment { key: StandBarKey; contribution: number; title: string }

const segments = computed(() => {
  const parts: Segment[] = COMPONENT_KEYS.map((key) => {
    const rank = props.breakdown.ranks[key];
    const weight = props.weights[key];
    return { key, contribution: rank * weight, title: `${key}: ${rank.toFixed(2)} × ${weight.toFixed(2)}` };
  });
  // The penalty is not weighted — it lands on the score as is, always ≤ 0.
  const penalty = props.breakdown.recencyPenalty;
  parts.push({ key: "recencyPenalty", contribution: penalty, title: `recencyPenalty: ${penalty.toFixed(2)}` });

  const total = parts.reduce((s, p) => s + Math.abs(p.contribution), 0) || 1;
  return parts
    .filter(p => p.contribution !== 0)
    .map(p => ({
      ...p,
      color: COMPONENT_COLORS[p.key],
      width: (Math.abs(p.contribution) / total) * 100,
      negative: p.contribution < 0,
    }));
});
</script>
