<template>
  <section
    v-if="track"
    ref="sectionRef"
    :class="sectionClass"
  >
    <div
      v-if="lyricsStore.status === 'loading'"
      class="space-y-5 pt-2 text-center"
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
    >
      <button
        v-for="(line, index) in lyricsStore.lines"
        :ref="element => setLineRef(element, index)"
        :key="`${line.time}-${index}`"
        type="button"
        :class="getLineClass(index, line.text)"
        @click="handleLineClick(line.time)"
      >
        {{ line.text || "\u00A0" }}
      </button>
    </div>

    <Empty
      v-else
      class="p-6 py-12 md:p-6 md:py-12"
    >
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          class="rounded-full text-muted-foreground"
        >
          <IconMicrophoneOff class="size-5" />
        </EmptyMedia>
        <EmptyDescription>{{ placeholderText }}</EmptyDescription>
      </EmptyHeader>
    </Empty>

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
import { type ComponentPublicInstance, computed, nextTick, onUnmounted, ref, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useEventListener } from "@vueuse/core";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import IconMicrophoneOff from "~icons/tabler/microphone-off";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useLyricsStore } from "@/modules/player/store/lyrics.store";
import type { PlayerTrack } from "@/modules/player/types";
import {
  type FollowEvent,
  type FollowState,
  INITIAL_FOLLOW_STATE,
  reduceFollow,
} from "@/modules/player/lib/lyrics-follow";
import IconArrowDown from "~icons/tabler/arrow-down";

const SKELETON_WIDTHS = ["55%", "72%", "48%", "66%", "38%", "60%", "44%"];

const props = withDefaults(defineProps<{
  variant?: "fullscreen" | "panel";
}>(), {
  variant: "fullscreen",
});

const playerStore = usePlayerStore();
const lyricsStore = useLyricsStore();
const { t } = useI18n();
const lineRefs: Array<HTMLElement | null> = [];
let lastActiveIndex = -1;

// ── Chat-like follow behavior ──────────────────────────────────────────────
// Auto-centering the active line "magnets" the view; once the user scrolls
// away on their own we release the magnet and offer a button to jump back,
// exactly like a chat that stops sticking to the bottom while you read
// history. Bringing the active line back near the center re-engages follow.

const sectionRef = useTemplateRef<HTMLElement>("sectionRef");
const scrollParent = ref<HTMLElement | null>(null);
const follow = ref<FollowState>(INITIAL_FOLLOW_STATE);
const dispatch = (event: FollowEvent) => {
  follow.value = reduceFollow(follow.value, event);
};
const isFollowing = computed(() => follow.value.following);
const resumeDirection = computed(() => follow.value.direction);

const showResumeButton = computed(() =>
  !isFollowing.value && lyricsStore.activeLineIndex >= 0 && lyricsStore.lines.length > 0,
);

watch(sectionRef, (el) => {
  scrollParent.value = findScrollParent(el);
});

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") return node;
    node = node.parentElement;
  }
  return null;
}

/** Active line center relative to the container center, in px (null = unmeasurable). */
function activeLineOffset(): number | null {
  const container = scrollParent.value;
  const line = lineRefs[lyricsStore.activeLineIndex];
  if (!container || !line) return null;
  const c = container.getBoundingClientRect();
  const r = line.getBoundingClientRect();
  return (r.top + r.bottom) / 2 - (c.top + c.height / 2);
}

// Only scrolls the user started can release the follow; a programmatic smooth
// scroll fires identical `scroll` events and must not. "User scrolling" lasts
// from the input until `scrollend` — fling inertia after touchend included.
let scrollEndTimer: ReturnType<typeof setTimeout> | null = null;
const onUserScrollStart = () => dispatch({ type: "userScrollStart" });
const onScrollEnd = () => {
  if (scrollEndTimer) {
    clearTimeout(scrollEndTimer);
    scrollEndTimer = null;
  }
  dispatch({ type: "scrollEnd" });
};

useEventListener(scrollParent, ["touchstart", "wheel"], onUserScrollStart, { passive: true });
useEventListener(scrollParent, "pointerdown", (e: PointerEvent) => {
  if (e.pointerType === "mouse") onUserScrollStart();
}, { passive: true });
useEventListener(scrollParent, "scroll", () => {
  const container = scrollParent.value;
  const offset = activeLineOffset();
  if (!container || offset === null) return;
  dispatch({ type: "scroll", offset, clientHeight: container.clientHeight });
  // Fallback for engines without `scrollend`: 200 ms of silence ends the scroll.
  if (scrollEndTimer) clearTimeout(scrollEndTimer);
  scrollEndTimer = setTimeout(onScrollEnd, 200);
}, { passive: true });
useEventListener(scrollParent, "scrollend", onScrollEnd, { passive: true });

const scrollToActiveLine = () => {
  lineRefs[lyricsStore.activeLineIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
};

const resumeFollow = () => {
  dispatch({ type: "resume" });
  scrollToActiveLine();
};

// A new track (or reloaded lyrics) starts followed again.
watch(() => lyricsStore.lines, () => {
  dispatch({ type: "linesChanged" });
  lastActiveIndex = -1;
});

// Any current track — ephemeral (YT/radio) tracks resolve lyrics via lrclib.
const track = computed<PlayerTrack | null>(() => playerStore.currentTrack);

const placeholderText = computed(() => {
  if (lyricsStore.status === "error") {
    return t("player.lyricsLoadFailed");
  }
  return t("player.lyricsEmpty");
});

const sectionClass = computed(() => {
  if (props.variant === "panel") {
    return "mx-auto w-full px-2 pb-8";
  }

  return "mx-auto w-full max-w-3xl px-4 pb-12 sm:px-6";
});

const linesClass = computed(() => {
  return props.variant === "panel" ? "space-y-4 text-center" : "space-y-5 text-center";
});

const stopWatch = watch(
  () => lyricsStore.activeLineIndex,
  async (index) => {
    if (index < 0 || index === lastActiveIndex) return;
    lastActiveIndex = index;
    await nextTick();

    if (!isFollowing.value) {
      // Not following: only keep the resume button's arrow pointing at the
      // line as it moves through the track.
      const container = scrollParent.value;
      const offset = activeLineOffset();
      if (container && offset !== null) {
        dispatch({ type: "scroll", offset, clientHeight: container.clientHeight });
      }
      return;
    }

    scrollToActiveLine();
  },
);

onUnmounted(() => {
  stopWatch();
  if (scrollEndTimer) clearTimeout(scrollEndTimer);
  lineRefs.length = 0;
});

function setLineRef(element: Element | ComponentPublicInstance | null, index: number) {
  lineRefs[index] = element instanceof HTMLElement ? element : null;
}

function handleLineClick(time: number) {
  if (!playerStore.canSeek) return;
  playerStore.seekTo(time);
}

function getLineClass(index: number, text: string): string {
  const isActive = index === lyricsStore.activeLineIndex;

  if (isActive) {
    if (props.variant === "panel") {
      return "lyrics-line-active block w-full cursor-pointer bg-transparent text-center text-2xl font-semibold leading-tight tracking-tight text-foreground";
    }

    return "lyrics-line-active block w-full cursor-pointer bg-transparent text-center text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl";
  }

  if (!text.trim()) {
    return "lyrics-line-inactive block h-6 w-full bg-transparent sm:h-8";
  }

  if (props.variant === "panel") {
    return "lyrics-line-inactive block w-full cursor-pointer bg-transparent text-center text-lg leading-relaxed text-muted-foreground/55";
  }

  return "lyrics-line-inactive block w-full cursor-pointer bg-transparent text-center text-xl leading-relaxed text-muted-foreground/55 sm:text-2xl";
}
</script>

<style scoped>
.lyrics-line-active,
.lyrics-line-inactive {
  transition:
    color 220ms ease,
    opacity 220ms ease,
    transform 260ms ease;
}

.lyrics-line-active {
  opacity: 1;
  transform: scale(1);
}

.lyrics-line-inactive {
  opacity: 0.58;
  transform: scale(0.985);
}

.lyrics-resume-enter-active,
.lyrics-resume-leave-active {
  transition:
    opacity 180ms ease-out,
    transform 180ms ease-out;
}

.lyrics-resume-enter-from,
.lyrics-resume-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
