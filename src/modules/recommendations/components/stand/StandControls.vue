<template>
  <div class="flex flex-col gap-4">
    <div
      v-for="key in SIGNAL_KEYS"
      :key="key"
      class="flex flex-col gap-1"
    >
      <div class="flex items-center justify-between text-xs">
        <span>{{ key }}</span>
        <input
          type="number"
          step="0.05"
          min="-1"
          max="1"
          class="w-16 rounded border bg-transparent px-1 text-right tabular-nums"
          :aria-label="key"
          :value="weights[key].toFixed(2)"
          @change="setWeight(key, ($event.target as HTMLInputElement).valueAsNumber)"
        >
      </div>
      <Slider
        :model-value="[weights[key]]"
        :min="-1"
        :max="1"
        :step="0.05"
        @update:model-value="v => setWeight(key, v?.[0] ?? 0)"
      />
    </div>

    <div class="grid grid-cols-3 gap-2 text-xs">
      <label
        for="stand-limit"
        class="flex flex-col gap-1"
      >limit
        <input
          id="stand-limit"
          type="number"
          min="1"
          max="50"
          class="rounded border bg-transparent px-1"
          :value="params.limit"
          @change="setParam('limit', $event)"
        >
      </label>
      <label
        for="stand-recent-window"
        class="flex flex-col gap-1"
      >recentWindow
        <input
          id="stand-recent-window"
          type="number"
          min="0"
          max="100"
          class="rounded border bg-transparent px-1"
          :value="params.recentWindow"
          @change="setParam('recentWindow', $event)"
        >
      </label>
      <label
        for="stand-max-per-artist"
        class="flex flex-col gap-1"
      >maxPerArtist
        <input
          id="stand-max-per-artist"
          type="number"
          min="0"
          max="20"
          class="rounded border bg-transparent px-1"
          :value="params.maxPerArtist"
          @change="setParam('maxPerArtist', $event)"
        >
      </label>
    </div>

    <div class="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="secondary"
        @click="$emit('reset')"
      >
        Сброс
      </Button>
      <Button
        size="sm"
        :disabled="tuning"
        @click="$emit('tune')"
      >
        Подобрать веса
      </Button>
      <Button
        size="sm"
        variant="secondary"
        @click="$emit('copy')"
      >
        Скопировать JSON
      </Button>
      <Button
        size="sm"
        variant="ghost"
        @click="$emit('reload')"
      >
        Перезагрузить данные
      </Button>
      <Button
        size="sm"
        variant="ghost"
        @click="$emit('export')"
      >
        Экспорт снимка
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { SIGNAL_KEYS, type SignalKey, type Weights } from "@/modules/recommendations/service/signals";
import type { ScoringParams } from "@/modules/recommendations/service/scoring";

defineProps<{ weights: Weights; params: ScoringParams; tuning: boolean }>();
const emit = defineEmits<{
  "reset": [];
  "tune": [];
  "copy": [];
  "reload": [];
  "export": [];
  "update:weight": [key: SignalKey, value: number];
  "update:param": [key: keyof ScoringParams, value: number];
}>();

const setWeight = (key: SignalKey, value: number) => {
  if (Number.isFinite(value)) emit("update:weight", key, Math.max(-1, Math.min(1, value)));
};

const PARAM_RANGES: Record<keyof ScoringParams, [number, number]> = {
  limit: [1, 50],
  recentWindow: [0, 100],
  maxPerArtist: [0, 20],
};

const setParam = (key: keyof ScoringParams, e: Event) => {
  const v = (e.target as HTMLInputElement).valueAsNumber;
  if (!Number.isFinite(v)) return;
  const [min, max] = PARAM_RANGES[key];
  emit("update:param", key, Math.round(Math.max(min, Math.min(max, v))));
};
</script>
