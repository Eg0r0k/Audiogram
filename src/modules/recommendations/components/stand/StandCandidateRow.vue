<template>
  <div
    class="grid grid-cols-[40px_1fr_64px_auto] items-center gap-3 px-3 py-2 rounded-lg"
    :class="row.label === 1 ? 'bg-green-500/10' : row.label === -1 ? 'bg-red-500/10' : 'hover:bg-muted/50'"
  >
    <EntityCoverImage
      owner-type="track"
      :owner-id="row.track.id"
      :alt="row.track.title"
      image-class="size-10 rounded"
    />
    <div class="min-w-0">
      <div class="truncate text-sm font-medium">
        {{ row.track.title }}
      </div>
      <div class="truncate text-xs text-muted-foreground">
        {{ row.track.artistName }}
      </div>
      <div class="mt-1 flex h-1.5 w-full overflow-hidden rounded bg-muted">
        <div
          v-for="seg in segments"
          :key="seg.key"
          :title="seg.title"
          :style="{ width: `${seg.width}%`, background: seg.color, opacity: seg.negative ? 0.4 : 1 }"
        />
      </div>
    </div>
    <div class="text-right text-xs tabular-nums">
      {{ row.score.toFixed(3) }}
    </div>
    <div class="flex gap-1">
      <Button
        size="icon-sm"
        :variant="row.label === 1 ? 'default' : 'ghost'"
        aria-label="Нравится"
        title="Нравится"
        @click="$emit('rate', 1)"
      >
        <IconThumbUp class="size-4" />
      </Button>
      <Button
        size="icon-sm"
        :variant="row.label === -1 ? 'default' : 'ghost'"
        aria-label="Не нравится"
        title="Не нравится"
        @click="$emit('rate', -1)"
      >
        <IconThumbDown class="size-4" />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Послушать"
        title="Послушать"
        @click="$emit('play')"
      >
        <IconPlayerPlay class="size-4" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import EntityCoverImage from "@/components/ui/EntityCoverImage.vue";
import { Button } from "@/components/ui/button";
import IconThumbUp from "~icons/tabler/thumb-up";
import IconThumbDown from "~icons/tabler/thumb-down";
import IconPlayerPlay from "~icons/tabler/player-play";
import { COMPONENT_KEYS, type ComponentWeights } from "@/modules/recommendations/lib/scoring";
import { COMPONENT_COLORS, type StandBarKey } from "@/modules/recommendations/service/stand-signal-meta";
import type { StandRow } from "@/modules/recommendations/composables/useRecoStand";

const props = defineProps<{ row: StandRow; weights: ComponentWeights }>();
defineEmits<{ rate: [label: 1 | -1]; play: [] }>();

interface Segment { key: StandBarKey; contribution: number; title: string }

const segments = computed(() => {
  const parts: Segment[] = COMPONENT_KEYS.map((key) => {
    const rank = props.row.breakdown.ranks[key];
    const weight = props.weights[key];
    return { key, contribution: rank * weight, title: `${key}: ${rank.toFixed(2)} × ${weight.toFixed(2)}` };
  });
  // The penalty is not weighted — it lands on the score as is, always ≤ 0.
  const penalty = props.row.breakdown.recencyPenalty;
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
