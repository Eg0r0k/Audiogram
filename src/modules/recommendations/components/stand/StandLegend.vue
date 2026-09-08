<template>
  <div class="flex flex-col gap-2 text-xs">
    <p class="text-muted-foreground">
      Легенда полоски: цвет = компонент, ширина = доля |вес × ранг|, полупрозрачный = отрицательный вклад
    </p>
    <div class="grid grid-cols-2 gap-x-3 gap-y-1.5">
      <div
        v-for="key in STAND_BAR_KEYS"
        :key="key"
        class="flex items-start gap-1.5"
      >
        <span
          class="mt-0.5 size-3 shrink-0 rounded-sm"
          :style="{ background: COMPONENT_COLORS[key] }"
        />
        <div class="min-w-0">
          <div class="text-xs font-medium">
            {{ key }}
          </div>
          <div class="text-xs text-muted-foreground">
            {{ COMPONENT_DESCRIPTIONS[key] }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { COMPONENT_COLORS, COMPONENT_DESCRIPTIONS, STAND_BAR_KEYS } from "@/modules/recommendations/service/stand-signal-meta";
</script>
