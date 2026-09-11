<template>
  <div class="flex flex-col gap-4">
    <p
      v-if="!started"
      class="px-3 py-8 text-center text-sm text-muted-foreground"
    >
      Выбери стартовый трек слева, поток начнётся сразу
    </p>
    <template v-else>
      <p
        v-if="!active"
        class="rounded-lg border border-yellow-500/50 px-3 py-2 text-sm"
      >
        Поток остановлен: в очереди другой трек. Выбери стартовый трек, чтобы начать заново.
      </p>
      <StandFeedCard
        v-if="split.current"
        :row="split.current"
        :source-title="titleOf(split.current.sourceId)"
        :weights="weights"
        @like="$emit('like')"
        @dislike="$emit('dislike')"
        @skip="$emit('skip')"
      />
      <section class="flex flex-col gap-1">
        <div class="flex items-center justify-between px-3">
          <h3 class="text-sm font-medium">
            Дальше
          </h3>
          <Button
            v-if="active"
            variant="ghost"
            size="sm"
            @click="$emit('rebuild')"
          >
            Пересчитать по текущим весам
          </Button>
        </div>
        <StandCandidateRow
          v-for="row in split.upcoming"
          :key="row.trackId"
          :row="row"
          :weights="weights"
          @rate="label => $emit('rate', row.trackId, label)"
          @jump="$emit('jump', row.trackId)"
        />
      </section>
      <section
        v-if="split.past.length"
        class="flex flex-col gap-1"
      >
        <h3 class="px-3 text-sm font-medium">
          Прошло
        </h3>
        <StandCandidateRow
          v-for="row in split.past"
          :key="row.trackId"
          :row="row"
          :weights="weights"
          @rate="label => $emit('rate', row.trackId, label)"
          @jump="$emit('jump', row.trackId)"
        />
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import type { TrackId } from "@/types/ids";
import type { ComponentWeights } from "@/modules/recommendations/lib/scoring";
import type { FeedSplit } from "@/modules/recommendations/service/stand-feed";
import StandCandidateRow from "./StandCandidateRow.vue";
import StandFeedCard from "./StandFeedCard.vue";

defineProps<{
  split: FeedSplit;
  weights: ComponentWeights;
  active: boolean;
  started: boolean;
  titleOf: (id: TrackId | null) => string;
}>();
defineEmits<{
  like: [];
  dislike: [];
  skip: [];
  rebuild: [];
  rate: [id: TrackId, label: 1 | -1];
  jump: [id: TrackId];
}>();
</script>
