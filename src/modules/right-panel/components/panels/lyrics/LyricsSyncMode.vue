<template>
  <div class="relative flex min-h-0 flex-1 flex-col">
    <p class="shrink-0 px-5 pt-2 pb-3 text-xs text-muted-foreground">
      {{ $t('lyrics.sync.hint') }}
    </p>

    <Scrollable class="min-h-0 flex-1">
      <div class="px-5 pt-2 pb-8">
        <LyricsLines
          kind="synced"
          :lines="syncLines"
          :active-index="-1"
          :target-index="targetIndex"
          :times="times"
          align="start"
          size="panel"
          :anchor-ratio="0.33"
          @select="markLine"
        />
      </div>
    </Scrollable>

    <FloatingActionButton show>
      <Button
        type="button"
        class="h-12 rounded-full px-5 tabular-nums shadow-lg has-[>svg]:px-5"
        :disabled="isPending"
        @click="isComplete ? save() : mark()"
      >
        <IconSave
          v-if="isComplete"
          class="size-6"
        />
        <IconCheck
          v-else
          class="size-6"
        />
        {{ isComplete ? $t('lyrics.save') : $t('lyrics.sync.mark', { time: formatLyricsTime(playerStore.currentTime) }) }}
      </Button>
    </FloatingActionButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useEventListener } from "@vueuse/core";
import FloatingActionButton from "@/components/common/FloatingActionButton.vue";
import { Button } from "@/components/ui/button";
import { Scrollable } from "@/components/ui/scrollable";
import LyricsLines from "@/modules/player/components/lyrics/LyricsLines.vue";
import { useLyricsActions } from "@/modules/player/composables/useLyricsActions";
import { buildLrc, formatLyricsTime, type LyricsLine } from "@/modules/player/lib/lrc";
import { usePlayerStore } from "@/modules/player/store/player.store";
import type { Track } from "@/types/track";
import IconCheck from "~icons/tabler/check";
import IconSave from "~icons/tabler/device-floppy";

const props = defineProps<{
  track: Track;
  lines: readonly string[];
}>();

const emit = defineEmits<{
  saved: [];
}>();

const marks = defineModel<number[]>({ required: true });

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const OVERLAY_ROLES = "[role='dialog'], [role='alertdialog'], [role='menu']";

const playerStore = usePlayerStore();
const { saveText, isPending } = useLyricsActions();

const syncLines = computed<LyricsLine[]>(() => props.lines.map(text => ({ time: 0, text })));

const markable = computed(() => props.lines.flatMap((text, index) => (text.trim() === "" ? [] : [index])));

const targetIndex = computed(() => markable.value[marks.value.length] ?? -1);

const isComplete = computed(() => marks.value.length >= markable.value.length);

const times = computed(() => {
  const result: (number | null)[] = props.lines.map(() => null);
  marks.value.forEach((mark, position) => {
    result[markable.value[position]] = mark;
  });
  return result;
});

const mark = () => {
  if (isComplete.value) return;
  const previous = marks.value.length > 0 ? marks.value[marks.value.length - 1] : 0;
  marks.value = [...marks.value, Math.max(playerStore.currentTime, previous)];
};

const markLine = (_line: LyricsLine, index: number) => {
  if (index === targetIndex.value) mark();
};

const save = async () => {
  if (!isComplete.value || isPending.value) return;
  const saved = await saveText(props.track, buildLrc(props.lines, marks.value), { resetOffset: true }).catch(() => null);
  if (saved) emit("saved");
};

const isTyping = () => {
  const focused = document.activeElement;
  return focused instanceof HTMLElement && (EDITABLE_TAGS.has(focused.tagName) || focused.isContentEditable);
};

const isOverlayOpen = (target: EventTarget | null) =>
  document.querySelector("[data-dismissable-layer]") !== null
  || (target instanceof Element && target.closest(OVERLAY_ROLES) !== null);

// Capture on window runs before the global Space hotkey, which listens on window in the bubble phase.
useEventListener(window, "keydown", (event: KeyboardEvent) => {
  if (event.key !== " " || isTyping() || isOverlayOpen(event.target)) return;
  event.preventDefault();
  event.stopPropagation();
  if (!event.repeat) mark();
}, { capture: true });

</script>
