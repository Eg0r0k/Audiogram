<template>
  <div class="flex flex-col gap-4">
    <div
      v-for="key in COMPONENT_KEYS"
      :key="key"
      class="flex flex-col gap-1"
    >
      <div class="flex items-center justify-between text-xs">
        <span :title="COMPONENT_DESCRIPTIONS[key]">{{ key }}</span>
        <input
          type="number"
          step="0.05"
          min="0"
          max="1"
          class="w-16 rounded border bg-transparent px-1 text-right tabular-nums"
          :aria-label="key"
          :value="weights[key].toFixed(2)"
          @change="setWeight(key, ($event.target as HTMLInputElement).valueAsNumber)"
        >
      </div>
      <Slider
        :model-value="[weights[key]]"
        :min="0"
        :max="1"
        :step="0.05"
        @update:model-value="v => setWeight(key, v?.[0] ?? 0)"
      />
    </div>

    <div class="grid grid-cols-3 gap-2 text-xs">
      <label
        v-for="spec in PARAM_SPECS"
        :key="spec.key"
        :for="`stand-param-${spec.key}`"
        class="flex flex-col gap-1"
      >{{ spec.key }}
        <input
          :id="`stand-param-${spec.key}`"
          type="number"
          :min="spec.min"
          :max="spec.max"
          :step="spec.step"
          class="rounded border bg-transparent px-1"
          :value="params[spec.key]"
          @change="setParam(spec, $event)"
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
import { COMPONENT_KEYS, type ComponentKey, type ComponentWeights } from "@/modules/recommendations/lib/scoring";
import { COMPONENT_DESCRIPTIONS } from "@/modules/recommendations/service/stand-signal-meta";
import type { StandParams } from "@/modules/recommendations/composables/useRecoStand";

defineProps<{ weights: ComponentWeights; params: StandParams; tuning: boolean }>();
const emit = defineEmits<{
  "reset": [];
  "tune": [];
  "copy": [];
  "reload": [];
  "export": [];
  "update:weight": [key: ComponentKey, value: number];
  "update:param": [key: keyof StandParams, value: number];
}>();

const setWeight = (key: ComponentKey, value: number) => {
  if (Number.isFinite(value)) emit("update:weight", key, Math.max(0, Math.min(1, value)));
};

interface ParamSpec { key: keyof StandParams; min: number; max: number; step: number }

const PARAM_SPECS: readonly ParamSpec[] = [
  { key: "limit", min: 1, max: 50, step: 1 },
  { key: "recentWindow", min: 0, max: 100, step: 1 },
  { key: "maxPerArtist", min: 0, max: 20, step: 1 },
  { key: "artistPenalty", min: 0, max: 1, step: 0.05 },
  { key: "albumPenalty", min: 0, max: 1, step: 0.05 },
  { key: "exploreShare", min: 0, max: 1, step: 0.05 },
];

const setParam = (spec: ParamSpec, e: Event) => {
  const raw = (e.target as HTMLInputElement).valueAsNumber;
  if (!Number.isFinite(raw)) return;
  const clamped = Math.max(spec.min, Math.min(spec.max, raw));
  emit("update:param", spec.key, spec.step === 1 ? Math.round(clamped) : clamped);
};
</script>
