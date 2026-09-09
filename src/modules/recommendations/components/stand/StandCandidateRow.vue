<template>
  <div
    class="grid grid-cols-[40px_1fr_64px_auto] items-center gap-3 px-3 py-2 rounded-lg"
    :class="row.label === 1 ? 'bg-green-500/10' : row.label === -1 ? 'bg-red-500/10' : 'hover:bg-muted/50'"
  >
    <EntityCoverImage
      owner-type="track"
      :owner-id="row.trackId"
      :alt="row.track.title"
      image-class="size-10 rounded"
    />
    <div class="min-w-0">
      <div class="flex items-center gap-2">
        <div class="truncate text-sm font-medium">
          {{ row.track.title }}
        </div>
        <span
          v-if="row.pick === 'explore'"
          class="shrink-0 rounded bg-yellow-500/20 px-1 text-[10px] font-medium uppercase tracking-wide text-yellow-700 dark:text-yellow-300"
        >
          разведка
        </span>
      </div>
      <div class="truncate text-xs text-muted-foreground">
        {{ row.track.artistName }}
      </div>
      <StandBreakdownBar
        v-if="row.breakdown"
        class="mt-1"
        :breakdown="row.breakdown"
        :weights="weights"
      />
    </div>
    <div class="text-right text-xs tabular-nums">
      {{ row.sourceId ? row.score.toFixed(3) : "старт" }}
    </div>
    <div class="flex gap-1">
      <Button
        size="icon-sm"
        :variant="row.label === 1 ? 'default' : 'ghost'"
        :disabled="!row.sourceId"
        aria-label="Нравится"
        title="Нравится"
        @click="$emit('rate', 1)"
      >
        <IconThumbUp class="size-4" />
      </Button>
      <Button
        size="icon-sm"
        :variant="row.label === -1 ? 'default' : 'ghost'"
        :disabled="!row.sourceId"
        aria-label="Не нравится"
        title="Не нравится"
        @click="$emit('rate', -1)"
      >
        <IconThumbDown class="size-4" />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Перейти"
        title="Перейти"
        @click="$emit('jump')"
      >
        <IconPlayerPlay class="size-4" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import EntityCoverImage from "@/components/ui/EntityCoverImage.vue";
import { Button } from "@/components/ui/button";
import IconThumbUp from "~icons/tabler/thumb-up";
import IconThumbDown from "~icons/tabler/thumb-down";
import IconPlayerPlay from "~icons/tabler/player-play";
import type { ComponentWeights } from "@/modules/recommendations/lib/scoring";
import type { FeedRow } from "@/modules/recommendations/service/stand-feed";
import StandBreakdownBar from "./StandBreakdownBar.vue";

defineProps<{ row: FeedRow; weights: ComponentWeights }>();
defineEmits<{ rate: [label: 1 | -1]; jump: [] }>();
</script>
