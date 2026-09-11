<template>
  <div
    class="flex gap-5 rounded-xl border p-5"
    :class="row.label === 1 ? 'border-green-500/60' : row.label === -1 ? 'border-red-500/60' : ''"
  >
    <EntityCoverImage
      owner-type="track"
      :owner-id="row.trackId"
      :alt="row.track.title"
      image-class="size-40 rounded-lg"
    />
    <div class="flex min-w-0 flex-1 flex-col gap-2">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <div class="truncate text-xl font-semibold">
            {{ row.track.title }}
          </div>
          <span
            v-if="row.pick === 'explore'"
            class="shrink-0 rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-yellow-700 dark:text-yellow-300"
          >
            разведка
          </span>
        </div>
        <div class="truncate text-muted-foreground">
          {{ row.track.artistName }}
        </div>
      </div>
      <div
        v-if="row.sourceId"
        class="truncate text-xs text-muted-foreground"
      >
        после: {{ sourceTitle }} · score {{ row.score.toFixed(3) }}
      </div>
      <div
        v-else
        class="text-xs text-muted-foreground"
      >
        стартовый трек
      </div>
      <StandBreakdownBar
        v-if="row.breakdown"
        :breakdown="row.breakdown"
        :weights="weights"
        thick
      />
      <div class="mt-auto flex gap-2">
        <Button
          v-if="row.sourceId"
          size="lg"
          :variant="row.label === -1 ? 'destructive' : 'outline'"
          @click="$emit('dislike')"
        >
          <IconThumbDown class="size-5" />
          Не то (D)
        </Button>
        <Button
          v-if="row.sourceId"
          size="lg"
          :variant="row.label === 1 ? 'default' : 'outline'"
          @click="$emit('like')"
        >
          <IconThumbUp class="size-5" />
          Нравится (L)
        </Button>
        <Button
          size="lg"
          variant="ghost"
          @click="$emit('skip')"
        >
          <IconPlayerSkipForward class="size-5" />
          Дальше (N)
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import EntityCoverImage from "@/components/ui/EntityCoverImage.vue";
import { Button } from "@/components/ui/button";
import IconThumbUp from "~icons/tabler/thumb-up";
import IconThumbDown from "~icons/tabler/thumb-down";
import IconPlayerSkipForward from "~icons/tabler/player-skip-forward";
import type { ComponentWeights } from "@/modules/recommendations/lib/scoring";
import type { FeedRow } from "@/modules/recommendations/service/stand-feed";
import StandBreakdownBar from "./StandBreakdownBar.vue";

defineProps<{ row: FeedRow; sourceTitle: string; weights: ComponentWeights }>();
defineEmits<{ like: []; dislike: []; skip: [] }>();
</script>
