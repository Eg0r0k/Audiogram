<template>
  <div class="flex flex-col gap-2 text-xs">
    <p class="text-muted-foreground">
      Легенда полоски: цвет = сигнал, ширина = доля |вес × значение|, полупрозрачный = отрицательный вклад
    </p>
    <div class="grid grid-cols-2 gap-x-3 gap-y-1.5">
      <div
        v-for="key in SIGNAL_KEYS"
        :key="key"
        class="flex items-start gap-1.5"
      >
        <span
          class="mt-0.5 size-3 shrink-0 rounded-sm"
          :style="{ background: SIGNAL_COLORS[key] }"
        />
        <div class="min-w-0">
          <div class="text-xs font-medium">
            {{ key }}
          </div>
          <div class="text-xs text-muted-foreground">
            {{ SIGNAL_DESCRIPTIONS[key] }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SIGNAL_KEYS } from "@/modules/recommendations/service/signals";
import { SIGNAL_COLORS, SIGNAL_DESCRIPTIONS } from "@/modules/recommendations/service/stand-signal-meta";
</script>
