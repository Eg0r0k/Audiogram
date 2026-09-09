<template>
  <div
    ref="containerRef"
    class="flex flex-col gap-2.5 pt-2"
  >
    <Scrollable
      ref="scrollableRef"
      :hide-thumb="true"
      direction="horizontal"
    >
      <TooltipProvider
        :delay-duration="150"
        disable-hoverable-content
      >
        <Tooltip
          :open="isTooltipOpen"
          @update:open="tooltipOpen = $event"
        >
          <TooltipTrigger
            as-child
            :reference="hoveredRect ?? undefined"
          >
            <svg
              :width="svgWidth"
              :height="svgHeight"
              class="block"
              role="img"
              :aria-label="t('common.heatmapAria')"
              @pointermove="onPointerMove"
              @pointerleave="onPointerLeave"
            >
              <text
                v-for="m in monthLabels"
                :key="m.weekIndex"
                :x="dayLabelWidth + m.weekIndex * pitch"
                y="11"
                class="fill-muted-foreground capitalize text-[11px]"
              >{{ m.label }}</text>

              <text
                v-for="label in dayLabels"
                :key="label.text"
                x="0"
                :y="monthLabelHeight + label.dayOfWeek * pitch + cellSize / 2 + 4"
                class="fill-muted-foreground text-[11px]"
              >{{ label.text }}</text>

              <g :transform="`translate(${dayLabelWidth}, ${monthLabelHeight})`">
                <g
                  v-for="(week, weekIndex) in weeks"
                  :key="weekIndex"
                  :transform="`translate(${weekIndex * pitch}, 0)`"
                >
                  <rect
                    v-for="cell in week"
                    :key="cell.date"
                    class="heatmap-cell"
                    :data-date="cell.date"
                    :y="cell.dayOfWeek * pitch"
                    :width="cellSize"
                    :height="cellSize"
                    rx="3"
                    :fill="cell.seconds > 0 ? 'var(--primary)' : 'var(--border)'"
                    :fill-opacity="cell.seconds > 0 ? levelFor(cell.seconds, maxSeconds) : 1"
                  />
                </g>
              </g>
            </svg>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            class="tabular-nums"
          >
            {{ hoveredTooltip }}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </Scrollable>

    <div class="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
      <span>{{ t("common.heatmapLess") }}</span>
      <span
        class="inline-block size-2.5 rounded-xs"
        :style="{ backgroundColor: 'var(--border)' }"
      />
      <span
        v-for="level in HEAT_LEVELS"
        :key="level"
        class="inline-block size-2.5 rounded-xs"
        :style="{ backgroundColor: 'var(--primary)', opacity: level }"
      />
      <span>{{ t("common.heatmapMore") }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, useTemplateRef, watch } from "vue";
import { useElementBounding } from "@vueuse/core";
import { Scrollable } from "@/components/ui/scrollable";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { DailyActivityPoint } from "@/db/repositories/stats.repository";
import { createCalendarTooltipFormatter } from "@/lib/format/time";
import { useI18n } from "vue-i18n";
import {
  HEAT_LEVELS,
  levelFor,
  MAX_WEEKS,
  MIN_WEEK_PITCH,
  toCells,
  visibleWeeks,
} from "./calendar-heatmap";

const { t, locale } = useI18n();

const props = defineProps<{ data: DailyActivityPoint[] }>();

const monthLabelHeight = 20;
const dayLabelWidth = 30;

const scrollableRef = useTemplateRef<{ scrollToEnd: (behavior?: ScrollBehavior) => void }>("scrollableRef");
const containerRef = useTemplateRef<HTMLElement>("containerRef");
const { width: containerWidth } = useElementBounding(containerRef);

const weeks = computed(() => visibleWeeks(toCells(props.data), MAX_WEEKS));

const availableWidth = computed(() => {
  const width = containerWidth.value > 0 ? containerWidth.value : 640;
  return Math.max(0, width - dayLabelWidth);
});
const pitch = computed(() =>
  Math.max(MIN_WEEK_PITCH, availableWidth.value / Math.max(1, weeks.value.length)),
);
const gap = computed(() => Math.min(4, Math.max(2, pitch.value * 0.18)));
const cellSize = computed(() => pitch.value - gap.value);

watch(weeks, async () => {
  await nextTick();
  scrollableRef.value?.scrollToEnd("auto");
}, { immediate: true });

const maxSeconds = computed(() =>
  Math.max(1, ...props.data.map(point => point.seconds)),
);

const monthLabels = computed(() => {
  const labels: { weekIndex: number; label: string }[] = [];
  let lastMonth = -1;
  const formatter = new Intl.DateTimeFormat(locale.value, { month: "short" });
  weeks.value.forEach((week, weekIndex) => {
    const first = week[0] as (typeof week)[number] | undefined;
    if (!first) return;
    const firstDate = new Date(`${first.date}T00:00:00`);
    const month = firstDate.getMonth();
    if (month !== lastMonth) {
      labels.push({ weekIndex, label: formatter.format(firstDate) });
      lastMonth = month;
    }
  });
  return labels;
});

const dayLabels = computed(() => [
  { dayOfWeek: 0, text: t("common.weekdayShort.mon") },
  { dayOfWeek: 2, text: t("common.weekdayShort.wed") },
  { dayOfWeek: 4, text: t("common.weekdayShort.fri") },
]);

const svgWidth = computed(() => dayLabelWidth + weeks.value.length * pitch.value);
const svgHeight = computed(() => monthLabelHeight + 7 * pitch.value - gap.value);

const tooltips = computed(() => {
  const format = createCalendarTooltipFormatter(locale.value, t);
  return new Map(props.data.map(point => [point.date, format(point.date, point.seconds)]));
});

// One Tooltip for the whole grid: the SVG is the trigger (so reka-ui keeps its
// open delay and leave handling) and the hovered rect is only the anchor.
// The 2–4px gaps between cells keep the last cell, otherwise every sweep
// across the grid closes and re-opens the tooltip.
const hoveredRect = shallowRef<Element | null>(null);
const hoveredDate = ref<string | null>(null);
const tooltipOpen = ref(false);
const isTooltipOpen = computed(() => tooltipOpen.value && hoveredDate.value !== null);
const hoveredTooltip = computed(() =>
  hoveredDate.value === null ? "" : tooltips.value.get(hoveredDate.value) ?? "",
);

const onPointerMove = (event: PointerEvent) => {
  const rect = (event.target as Element | null)?.closest("rect[data-date]");
  if (!rect) return;
  hoveredRect.value = rect;
  hoveredDate.value = rect.getAttribute("data-date");
};

const onPointerLeave = () => {
  hoveredRect.value = null;
  hoveredDate.value = null;
};
</script>

<style scoped>
.heatmap-cell:hover {
  stroke: var(--foreground);
  stroke-opacity: 0.4;
  stroke-width: 1;
}
</style>
