<template>
  <div class="relative flex min-h-0 flex-1 flex-col">
    <div class="shrink-0 px-5 pt-2 pb-3">
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          color="neutral"
          size="icon-sm"
          :aria-label="$t('lyrics.adjust.earlier')"
          @pointerdown="startHold(-1, $event)"
          @pointerup="stopHold"
          @pointercancel="stopHold"
          @pointerleave="stopHold"
          @click="stepFromKeyboard(-1, $event)"
        >
          <IconMinus />
        </Button>
        <span
          role="status"
          class="min-w-16 text-center text-sm font-semibold tabular-nums"
        >
          {{ valueLabel }}
        </span>
        <Button
          variant="outline"
          color="neutral"
          size="icon-sm"
          :aria-label="$t('lyrics.adjust.later')"
          @pointerdown="startHold(1, $event)"
          @pointerup="stopHold"
          @pointercancel="stopHold"
          @pointerleave="stopHold"
          @click="stepFromKeyboard(1, $event)"
        >
          <IconPlus />
        </Button>
        <Button
          variant="ghost"
          color="destructive"
          size="sm"
          class="-mr-3 ml-auto"
          :disabled="offset === 0"
          @click="offset = 0"
        >
          {{ $t('lyrics.adjust.reset') }}
        </Button>
      </div>
      <p class="mt-2 text-xs text-muted-foreground">
        {{ $t('lyrics.adjust.hint') }}
      </p>
    </div>

    <Scrollable class="min-h-0 flex-1">
      <div class="px-5 pt-2 pb-8">
        <LyricsLines
          kind="synced"
          :lines="lines"
          :active-index="activeLineIndex"
          :times="times"
          align="start"
          size="panel"
          :anchor-ratio="0.33"
          @select="syncTo"
        />
      </div>
    </Scrollable>

    <FloatingActionButton :show="dirty">
      <Button
        type="button"
        class="size-12 rounded-full shadow-lg"
        :aria-label="$t('lyrics.adjust.save')"
        :disabled="isPending || !dirty"
        @click="save"
      >
        <IconSave class="size-6" />
      </Button>
    </FloatingActionButton>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from "vue";
import { useI18n } from "vue-i18n";
import FloatingActionButton from "@/components/common/FloatingActionButton.vue";
import { Button } from "@/components/ui/button";
import { Scrollable } from "@/components/ui/scrollable";
import LyricsLines from "@/modules/player/components/lyrics/LyricsLines.vue";
import { useCurrentLyrics } from "@/modules/player/composables/useCurrentLyrics";
import { useLyricsActions } from "@/modules/player/composables/useLyricsActions";
import type { LyricsLine } from "@/modules/player/lib/lrc";
import { useLyricsStore } from "@/modules/player/store/lyrics.store";
import { usePlayerStore } from "@/modules/player/store/player.store";
import type { Track } from "@/modules/player/types";
import IconSave from "~icons/tabler/device-floppy";
import IconMinus from "~icons/tabler/minus";
import IconPlus from "~icons/tabler/plus";

type Direction = 1 | -1;

const props = defineProps<{
  track: Track;
  dirty: boolean;
}>();

const emit = defineEmits<{
  saved: [];
}>();

const offset = defineModel<number>({ required: true });

const STEP_MS = 100;
const HOLD_DELAY_MS = 400;
const REPEAT_MS = 100;

const { t, locale } = useI18n();
const playerStore = usePlayerStore();
const lyricsStore = useLyricsStore();
const { lines, activeLineIndex } = useCurrentLyrics();
const { setOffset, isPending } = useLyricsActions();

const secondsFormat = computed(() => new Intl.NumberFormat(locale.value, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
}));

const valueLabel = computed(() =>
  t("lyrics.adjust.value", { value: secondsFormat.value.format(offset.value / 1000) }));

const times = computed(() => lines.value.map(line => line.time + offset.value / 1000));

const roundToStep = (ms: number) => Math.round(ms / STEP_MS) * STEP_MS;

const step = (direction: Direction) => {
  offset.value = roundToStep(offset.value + direction * STEP_MS);
};

let holdTimer: ReturnType<typeof setTimeout> | null = null;

const stopHold = () => {
  if (holdTimer !== null) clearTimeout(holdTimer);
  holdTimer = null;
};

const repeatAfter = (direction: Direction, delay: number) => {
  holdTimer = setTimeout(() => {
    step(direction);
    repeatAfter(direction, REPEAT_MS);
  }, delay);
};

const startHold = (direction: Direction, event: PointerEvent) => {
  if (event.button !== 0) return;
  stopHold();
  step(direction);
  repeatAfter(direction, HOLD_DELAY_MS);
};

// A pointer press has already stepped; a keyboard click carries detail 0.
const stepFromKeyboard = (direction: Direction, event: MouseEvent) => {
  if (event.detail === 0) step(direction);
};

// Rounded down, so the tapped line is the active one even while paused.
const syncTo = (line: LyricsLine) => {
  offset.value = Math.floor((playerStore.currentTime - line.time) * 1000 / STEP_MS) * STEP_MS;
};

const save = async () => {
  if (!props.dirty || isPending.value) return;
  const saved = await setOffset(props.track, offset.value).catch(() => null);
  if (!saved) return;
  lyricsStore.setPreviewOffset(null);
  emit("saved");
};

watch(offset, ms => lyricsStore.setPreviewOffset(ms), { immediate: true });

onBeforeUnmount(() => {
  stopHold();
  lyricsStore.setPreviewOffset(null);
});
</script>
