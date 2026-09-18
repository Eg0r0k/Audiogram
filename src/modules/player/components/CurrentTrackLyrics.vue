<template>
  <section
    v-if="track"
    :class="sectionClass"
    :data-lyrics-mode="mode"
  >
    <div
      v-if="lyricsStore.status === 'loading'"
      :class="[linesClass, 'pt-2']"
    >
      <Skeleton
        v-for="(width, i) in SKELETON_WIDTHS"
        :key="i"
        :style="{ width }"
        class="mx-auto h-5 sm:h-7"
      />
    </div>

    <div
      v-else-if="lyricsStore.lines.length > 0"
      :class="linesClass"
      :style="{ paddingBottom: `${tailSpace}px` }"
    >
      <button
        v-for="(line, index) in lyricsStore.lines"
        :ref="element => setLineRef(element, index)"
        :key="`${line.time}-${index}`"
        type="button"
        :class="lineClass(index, line.text)"
        @click="handleLineClick(line.time)"
      >
        {{ line.text || "\u00A0" }}
      </button>
    </div>

    <div
      v-else
      class="flex flex-col h-full"
    >
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <IconMicrophoneOff class="size-11 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle>{{ placeholderText }}</EmptyTitle>
        </EmptyHeader>
        <EmptyContent v-if="attachableTrack">
          <Button
            variant="outline"
            :disabled="isAttachingLyrics"
            @click="attachLyrics"
          >
            <IconFileMusic
              class="size-4"
              :class="{ 'animate-pulse': isAttachingLyrics }"
            />
            {{ attachLabel }}
          </Button>
        </EmptyContent>
      </Empty>
    </div>

    <Transition name="lyrics-resume">
      <div
        v-if="showResumeButton"
        class="pointer-events-none sticky bottom-6 z-10 flex justify-center"
      >
        <Button
          size="sm"
          variant="secondary"
          class="pointer-events-auto rounded-full shadow-lg"
          @click="resumeFollow"
        >
          <IconArrowDown
            class="size-4 transition-transform"
            :class="{ 'rotate-180': resumeDirection === 'up' }"
          />
          {{ t("player.lyricsResumeFollow") }}
        </Button>
      </div>
    </Transition>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { cva, type VariantProps } from "class-variance-authority";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import IconMicrophoneOff from "~icons/tabler/microphone-off";
import IconFileMusic from "~icons/tabler/file-music";
import IconArrowDown from "~icons/tabler/arrow-down";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useLyricsStore } from "@/modules/player/store/lyrics.store";
import type { PlayerTrack } from "@/modules/player/types";
import { useAttachCurrentTrackLyrics } from "../composables/useAttachCurrentTrackLyrics";
import { useLyricsFollow } from "../composables/useLyricsFollow";

const SKELETON_WIDTHS = ["55%", "72%", "48%", "66%", "38%", "60%", "44%"];

const sectionVariants = cva("mx-auto w-full", {
  variants: {
    variant: {
      fullscreen: "max-w-3xl px-4 pb-12 sm:px-6",
      panel: "h-full px-2 pb-8",
    },
  },
  defaultVariants: { variant: "fullscreen" },
});

const linesVariants = cva("text-center", {
  variants: {
    variant: {
      fullscreen: "space-y-5",
      panel: "space-y-4",
    },
  },
  defaultVariants: { variant: "fullscreen" },
});

const lineVariants = cva("lyrics-line block w-full bg-transparent text-center", {
  variants: {
    variant: {
      fullscreen: "",
      panel: "",
    },
    state: {
      active: "lyrics-line-active cursor-pointer font-semibold leading-tight tracking-tight text-foreground",
      upcoming: "lyrics-line-upcoming cursor-pointer leading-relaxed text-foreground",
      past: "lyrics-line-past cursor-pointer leading-relaxed text-foreground",
      blank: "lyrics-line-upcoming h-6 sm:h-8",
    },
  },
  compoundVariants: [
    { variant: "fullscreen", state: "active", class: "text-3xl sm:text-5xl" },
    { variant: "panel", state: "active", class: "text-2xl" },
    { variant: "fullscreen", state: "upcoming", class: "text-xl sm:text-2xl" },
    { variant: "panel", state: "upcoming", class: "text-lg" },
    { variant: "fullscreen", state: "past", class: "text-xl sm:text-2xl" },
    { variant: "panel", state: "past", class: "text-lg" },
  ],
  defaultVariants: { variant: "fullscreen", state: "upcoming" },
});

type LineState = NonNullable<VariantProps<typeof lineVariants>["state"]>;

const props = withDefaults(defineProps<{
  variant?: "fullscreen" | "panel";
}>(), {
  variant: "fullscreen",
});

const playerStore = usePlayerStore();
const lyricsStore = useLyricsStore();
const { t } = useI18n();

// Any current track — ephemeral (YT/radio) tracks resolve lyrics via lrclib.
const track = computed<PlayerTrack | null>(() => playerStore.currentTrack);

const placeholderText = computed(() =>
  lyricsStore.status === "error"
    ? t("player.lyricsLoadFailed")
    : t("player.lyricsEmpty"),
);

const { attachableTrack, attachLabel, isAttachingLyrics, attachLyrics } = useAttachCurrentTrackLyrics();

const { setLineRef, showResumeButton, resumeDirection, resumeFollow, mode, tailSpace } = useLyricsFollow({
  lines: () => lyricsStore.lines,
  activeLineIndex: () => lyricsStore.activeLineIndex,
});

const sectionClass = computed(() => sectionVariants({ variant: props.variant }));
const linesClass = computed(() => linesVariants({ variant: props.variant }));

// A line with no text is a spacer between verses: it keeps its height and
// loses the pointer, so the active check still wins over it. Everything still
// to be sung stays readable; what is already sung falls away behind the anchor.
const lineState = (index: number, text: string): LineState => {
  if (index === lyricsStore.activeLineIndex) return "active";
  if (!text.trim()) return "blank";
  return index < lyricsStore.activeLineIndex ? "past" : "upcoming";
};

const lineClass = (index: number, text: string) =>
  lineVariants({ variant: props.variant, state: lineState(index, text) });

const handleLineClick = (time: number) => {
  if (!playerStore.canSeek) return;
  playerStore.seekTo(time);
};
</script>

<style scoped>
/* Light carries the state, and it settles slower than the scroll that moves
   the list (300ms) — the line finishes arriving before it finishes lighting. */
.lyrics-line {
  transition: opacity 450ms ease;
}

.lyrics-line-active {
  opacity: 1;
}

/* What is still to be sung stays readable — it is the part worth following. */
.lyrics-line-upcoming {
  opacity: 0.3;
}

/* Sung lines fall away above the anchor, and come back when the user reaches
   for the text. */
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
