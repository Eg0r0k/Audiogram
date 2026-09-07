<template>
  <div class="flex flex-col gap-1">
    <p
      v-if="!sourceId"
      class="px-3 py-8 text-center text-sm text-muted-foreground"
    >
      Выбери исходный трек слева
    </p>
    <template v-else>
      <StandCandidateRow
        v-for="row in rows"
        :key="row.trackId"
        :row="row"
        :weights="weights"
        @rate="label => $emit('rate', row.trackId, label)"
        @play="$emit('play', row.track)"
      />
      <Button
        variant="ghost"
        class="mt-2"
        @click="$emit('more')"
      >
        Ещё {{ step }}
      </Button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import type { TrackEntity } from "@/db/entities";
import type { TrackId } from "@/types/ids";
import type { Weights } from "@/modules/recommendations/service/signals";
import type { StandRow } from "@/modules/recommendations/composables/useRecoStand";
import StandCandidateRow from "./StandCandidateRow.vue";

defineProps<{ rows: StandRow[]; weights: Weights; sourceId: TrackId | null; step: number }>();
defineEmits<{ rate: [id: TrackId, label: 1 | -1]; play: [track: TrackEntity]; more: [] }>();
</script>
