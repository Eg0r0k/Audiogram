import { computed, inject, nextTick, onUnmounted, ref, watch } from "vue";
import type { ComponentPublicInstance } from "vue";
import { useEventListener, useResizeObserver } from "@vueuse/core";
import { scrollableInjectionKey } from "@/components/ui/scrollable/injection";
import { REDUCED_MOTION_QUERY } from "@/app/reduced-motion";
import { easeCss } from "@/lib/easing";
import type { LyricsLine } from "../lib/lrc";
import {
  type FollowEvent,
  type FollowState,
  INITIAL_FOLLOW_STATE,
  reduceFollow,
} from "../lib/lyrics-follow";

interface LyricsFollowSource {
  lines: () => LyricsLine[];
  activeLineIndex: () => number;
}

/** Idle shows only the sung line; reading lifts the whole text so it can be read. */
export type LyricsMode = "idle" | "hover" | "reading";

const SCROLL_MS = 300;

const ANCHOR_RATIO = 0.1;

/**
 * Chat-like follow behavior for a lyrics list.
 *
 * Auto-centering the active line "magnets" the view; once the user scrolls
 * away on their own we release the magnet and offer a button to jump back,
 * exactly like a chat that stops sticking to the bottom while you read
 * history. Bringing the active line back near the center re-engages follow.
 *
 * The caller binds {@link setLineRef} to each rendered line and must render
 * inside a `<Scrollable>` — that is where the scroll element comes from.
 */
export const useLyricsFollow = (source: LyricsFollowSource) => {
  const lineRefs: Array<HTMLElement | null> = [];
  let lastActiveIndex = -1;
  let scrollEndTimer: ReturnType<typeof setTimeout> | null = null;
  let scrollFrame: number | null = null;

  const follow = ref<FollowState>(INITIAL_FOLLOW_STATE);
  const dispatch = (event: FollowEvent) => {
    follow.value = reduceFollow(follow.value, event);
  };

  const isFollowing = computed(() => follow.value.following);
  const resumeDirection = computed(() => follow.value.direction);

  const showResumeButton = computed(() =>
    !isFollowing.value && source.activeLineIndex() >= 0 && source.lines().length > 0,
  );

  // Without a Scrollable ancestor the follow release cannot be detected, but
  // the active line still gets centered — the magnet just never lets go.
  const scrollable = inject(scrollableInjectionKey, null);
  const scrollParent = computed(() => scrollable?.containerRef.value ?? null);

  const isPointerOver = ref(false);
  const mode = computed<LyricsMode>(() => {
    if (!isFollowing.value) return "reading";
    return isPointerOver.value ? "hover" : "idle";
  });

  useEventListener(scrollParent, "pointerenter", () => {
    isPointerOver.value = true;
  });
  useEventListener(scrollParent, "pointerleave", () => {
    isPointerOver.value = false;
  });

  /** Active line center relative to the anchor line, in px (null = unmeasurable). */
  const activeLineOffset = (): number | null => {
    const container = scrollParent.value;
    const line = lineRefs[source.activeLineIndex()];
    if (!container || !line) return null;
    const c = container.getBoundingClientRect();
    const r = line.getBoundingClientRect();
    return (r.top + r.bottom) / 2 - (c.top + c.height * ANCHOR_RATIO);
  };

  // The last lines of a song can only reach an anchor this high up if there is
  // empty room under them to scroll into.
  const tailSpace = ref(0);
  const measureTail = () => {
    const container = scrollParent.value;
    tailSpace.value = container ? Math.round(container.clientHeight * (1 - ANCHOR_RATIO)) : 0;
  };
  watch(scrollParent, measureTail, { immediate: true });
  useResizeObserver(scrollParent, measureTail);

  const cancelScroll = () => {
    if (scrollFrame != null) cancelAnimationFrame(scrollFrame);
    scrollFrame = null;
  };

  // `scroll-behavior: auto` from the global reduced-motion block does NOT
  // cover a scripted scroll, so the preference is checked here.
  const reducedMotion = typeof matchMedia === "undefined" ? null : matchMedia(REDUCED_MOTION_QUERY);

  const scrollToActiveLine = () => {
    const container = scrollParent.value;
    const offset = activeLineOffset();
    if (!container || offset === null) return;

    cancelScroll();
    const from = container.scrollTop;
    const to = from + offset;
    if (Math.abs(offset) < 1) return;
    if (reducedMotion?.matches) {
      container.scrollTop = to;
      return;
    }

    const start = performance.now();
    const step = () => {
      const progress = Math.min(1, (performance.now() - start) / SCROLL_MS);
      container.scrollTop = from + (to - from) * easeCss(progress);
      scrollFrame = progress < 1 ? requestAnimationFrame(step) : null;
    };
    scrollFrame = requestAnimationFrame(step);
  };

  const onUserScrollStart = () => {
    cancelScroll();
    dispatch({ type: "userScrollStart" });
  };
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
    if (scrollEndTimer) clearTimeout(scrollEndTimer);
    scrollEndTimer = setTimeout(onScrollEnd, 200);
  }, { passive: true });
  useEventListener(scrollParent, "scrollend", onScrollEnd, { passive: true });

  const resumeFollow = () => {
    dispatch({ type: "resume" });
    scrollToActiveLine();
  };

  const setLineRef = (element: Element | ComponentPublicInstance | null, index: number) => {
    lineRefs[index] = element instanceof HTMLElement ? element : null;
  };

  // A new track (or reloaded lyrics) starts followed again. Refs past the new
  // last line would otherwise keep pointing at the previous track's nodes.
  watch(source.lines, (lines) => {
    lineRefs.length = lines.length;
    dispatch({ type: "linesChanged" });
    lastActiveIndex = -1;
  });

  watch(source.activeLineIndex, async (index) => {
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
  });

  onUnmounted(() => {
    cancelScroll();
    if (scrollEndTimer) clearTimeout(scrollEndTimer);
    lineRefs.length = 0;
  });

  return { setLineRef, showResumeButton, resumeDirection, resumeFollow, mode, tailSpace };
};
