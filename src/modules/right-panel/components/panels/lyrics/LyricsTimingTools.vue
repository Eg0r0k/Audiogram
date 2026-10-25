<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="shrink-0 px-5 pt-2 pb-3">
      <div class="flex items-center gap-3">
        <InputNumber
          v-model="seconds"
          variant="soft"
          class="flex-1"
          :step="STEP_MS / 1000"
          :min="-MAX_OFFSET_S"
          :max="MAX_OFFSET_S"
          :format-options="SECONDS_FORMAT"
          :locale="locale"
        >
          <InputNumberDecrement :aria-label="$t('lyrics.adjust.earlier')" />
          <InputNumberInput
            class="font-semibold tabular-nums"
            :aria-label="$t('lyrics.adjust.offset')"
          />
          <InputNumberIncrement :aria-label="$t('lyrics.adjust.later')" />
        </InputNumber>
        <Button
          variant="ghost"
          color="destructive"
          size="sm"
          class="-mr-3"
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
  </div>

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
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from "vue";
import { useI18n } from "vue-i18n";
import FloatingActionButton from "@/components/common/FloatingActionButton.vue";
import { Button } from "@/components/ui/button";
import { InputNumber, InputNumberDecrement, InputNumberIncrement, InputNumberInput } from "@/components/ui/input-number";
import { Scrollable } from "@/components/ui/scrollable";
import LyricsLines from "@/modules/player/components/lyrics/LyricsLines.vue";
import { useCurrentLyrics } from "@/modules/player/composables/useCurrentLyrics";
import { useLyricsActions } from "@/modules/player/composables/useLyricsActions";
import type { LyricsLine } from "@/modules/player/lib/lrc";
import { useLyricsStore } from "@/modules/player/store/lyrics.store";
import { usePlayerStore } from "@/modules/player/store/player.store";
import type { Track } from "@/types/track";
import IconSave from "~icons/tabler/device-floppy";

const props = defineProps<{
  track: Track;
  dirty: boolean;
}>();

const emit = defineEmits<{
  saved: [];
}>();

const offset = defineModel<number>({ required: true });

const STEP_MS = 100;
const MAX_OFFSET_S = 600;

const SECONDS_FORMAT: Intl.NumberFormatOptions = {
  style: "unit",
  unit: "second",
  unitDisplay: "narrow",
  signDisplay: "exceptZero",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
};

const { locale } = useI18n();
const playerStore = usePlayerStore();
const lyricsStore = useLyricsStore();
const { lines, activeLineIndex } = useCurrentLyrics();
const { setOffset, isPending } = useLyricsActions();

// The field works in seconds; the offset is stored in whole 100 ms steps.
const seconds = computed({
  get: () => offset.value / 1000,
  set: (value: number | undefined) => {
    offset.value = value !== undefined && Number.isFinite(value) ? Math.round(value * 1000 / STEP_MS) * STEP_MS : 0;
  },
});

const times = computed(() => lines.value.map(line => line.time + offset.value / 1000));

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
  lyricsStore.setPreviewOffset(null);
});
</script>
