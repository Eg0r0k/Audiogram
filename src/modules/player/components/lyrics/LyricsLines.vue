<template>
  <div :data-lyrics-mode="isSynced ? mode : undefined">
    <div
      :class="listVariants({ size })"
      :style="isSynced ? { paddingBottom: `${tailSpace}px` } : undefined"
    >
      <div
        v-for="verse in verses"
        :key="verse.start"
        data-slot="lyrics-verse"
        :class="verseVariants({ size })"
      >
        <template v-if="isSynced">
          <button
            v-for="{ line, index } in verse.lines"
            :key="`${line.time}-${index}`"
            :ref="element => setLineRef(element, index)"
            type="button"
            data-slot="lyrics-line"
            :aria-current="index === highlightedIndex || undefined"
            :class="lineClass(index)"
            @click="emit('select', line, index)"
          >
            <span :class="times && 'min-w-0 flex-1'">{{ line.text }}</span>
            <span
              v-if="timeLabels[index]"
              class="shrink-0 text-xs tabular-nums text-muted-foreground"
            >
              {{ timeLabels[index] }}
            </span>
          </button>
        </template>
        <template v-else>
          <p
            v-for="{ line, index } in verse.lines"
            :key="index"
            data-slot="lyrics-line"
            :class="plainLineVariants({ size, align })"
          >
            {{ line.text }}
          </p>
        </template>
      </div>
    </div>

    <Transition name="lyrics-resume">
      <div
        v-if="isSynced && showResumeButton"
        class="pointer-events-none sticky bottom-6 z-10 flex justify-center"
      >
        <Button
          variant="soft"
          color="neutral"
          size="sm"
          class="pointer-events-auto h-9 rounded-full bg-muted text-foreground"
          @click="resumeFollow"
        >
          <IconArrowUp v-if="resumeDirection === 'up'" />
          <IconArrowDown v-else />
          {{ $t("player.lyricsResumeFollow") }}
        </Button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { cva } from "class-variance-authority";
import { Button } from "@/components/ui/button";
import IconArrowDown from "~icons/tabler/arrow-down";
import IconArrowUp from "~icons/tabler/arrow-up";
import { formatLyricsTime, type LyricsLine } from "@/modules/player/lib/lrc";
import { useLyricsFollow } from "@/modules/player/composables/useLyricsFollow";

type LineState = "active" | "upcoming" | "past" | "target";
type Verse = { start: number; lines: { line: LyricsLine; index: number }[] };

const props = defineProps<{
  lines: readonly LyricsLine[];
  kind: "synced" | "plain";
  activeIndex: number;
  align: "start" | "center";
  size: "panel" | "fullscreen";
  anchorRatio: number;
  times?: readonly (number | null)[];
  targetIndex?: number;
}>();

const emit = defineEmits<{
  select: [line: LyricsLine, index: number];
}>();

const NO_LINES: readonly LyricsLine[] = [];

const listVariants = cva("flex flex-col", {
  variants: {
    size: {
      panel: "gap-5",
      fullscreen: "gap-16 sm:gap-18",
    },
  },
});

const verseVariants = cva("flex flex-col", {
  variants: {
    size: {
      panel: "gap-1",
      fullscreen: "gap-5",
    },
  },
});

const lineVariants = cva("cursor-pointer", {
  variants: {
    size: {
      panel: "-mx-2 rounded-md px-2 text-xl leading-7 font-semibold hover:bg-muted",
      fullscreen: "lyrics-line w-full",
    },
    align: {
      start: "text-start",
      center: "text-center",
    },
    state: {
      active: "",
      upcoming: "",
      past: "",
      target: "bg-muted text-foreground",
    },
    timed: {
      true: "flex items-baseline gap-3",
      false: "block",
    },
  },
  compoundVariants: [
    { size: "panel", state: "active", class: "text-foreground" },
    { size: "panel", state: ["upcoming", "past"], class: "text-muted-foreground" },
    {
      size: "fullscreen",
      state: "active",
      class: "lyrics-line-active text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl",
    },
    { size: "fullscreen", state: "upcoming", class: "lyrics-line-upcoming text-xl leading-relaxed text-foreground sm:text-2xl" },
    { size: "fullscreen", state: "past", class: "lyrics-line-past text-xl leading-relaxed text-foreground sm:text-2xl" },
    { size: "fullscreen", state: "target", class: "lyrics-line-active text-xl leading-relaxed sm:text-2xl" },
  ],
});

const plainLineVariants = cva("text-foreground", {
  variants: {
    size: {
      panel: "text-base leading-6",
      fullscreen: "text-xl leading-relaxed sm:text-2xl",
    },
    align: {
      start: "text-start",
      center: "text-center",
    },
  },
});

const isSynced = computed(() => props.kind === "synced");

const hasTextAt = (index: number) =>
  index >= 0 && index < props.lines.length && props.lines[index].text.trim() !== "";

const verses = computed(() => {
  const groups: Verse[] = [];
  let current: Verse | null = null;
  for (const [index, line] of props.lines.entries()) {
    if (line.text.trim() === "") {
      current = null;
      continue;
    }
    if (!current) {
      current = { start: index, lines: [] };
      groups.push(current);
    }
    current.lines.push({ line, index });
  }
  return groups;
});

const highlightedIndex = computed(() => (isSynced.value && hasTextAt(props.activeIndex) ? props.activeIndex : -1));

// A blank active line (an instrumental break) keeps following the last sung line, so nothing scrolls.
const followedIndex = computed(() => {
  if (!isSynced.value) return -1;
  let index = props.targetIndex !== undefined && props.targetIndex >= 0 ? props.targetIndex : props.activeIndex;
  while (index >= 0 && !hasTextAt(index)) index--;
  return index;
});

const timeLabels = computed(() => props.times?.map(time => (time === null ? null : formatLyricsTime(time))) ?? []);

const lineState = (index: number): LineState => {
  if (index === props.targetIndex) return "target";
  if (index === highlightedIndex.value) return "active";
  return index < props.activeIndex ? "past" : "upcoming";
};

const lineClass = (index: number) =>
  lineVariants({
    size: props.size,
    align: props.align,
    state: lineState(index),
    timed: props.times !== undefined,
  });

const { setLineRef, showResumeButton, resumeDirection, resumeFollow, mode, tailSpace } = useLyricsFollow({
  lines: () => (isSynced.value ? props.lines : NO_LINES),
  activeLineIndex: () => followedIndex.value,
  anchorRatio: () => props.anchorRatio,
});
</script>

<style scoped>
/* Opacity settles slower than the 300ms follow scroll, so a line arrives before it lights up. */
.lyrics-line {
  transition: opacity 450ms ease;
}

.lyrics-line-active {
  opacity: 1;
}

.lyrics-line-upcoming {
  opacity: 0.3;
}

.lyrics-line-past {
  opacity: 0;
}

[data-lyrics-mode="reading"] .lyrics-line-past,
[data-lyrics-mode="reading"] .lyrics-line-upcoming {
  opacity: 1;
}

@media (hover: hover) and (pointer: fine) {
  [data-lyrics-mode="hover"] .lyrics-line-past {
    opacity: 0.1;
  }
}

.lyrics-resume-enter-active,
.lyrics-resume-leave-active {
  transition:
    opacity 180ms var(--ease-out),
    transform 180ms var(--ease-out);
}

.lyrics-resume-enter-from,
.lyrics-resume-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
