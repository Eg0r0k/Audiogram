import { useEventListener } from "@vueuse/core";
import type { MaybeRefOrGetter } from "vue";

// A tap that drifts further than the slop is a swipe or a scrub; one that is
// held longer than TAP_MAX_MS is a long press, which opens a context menu.
const TAP_SLOP_PX = 12;
const TAP_MAX_MS = 400;
const DOUBLE_TAP_MS = 320;
// The second tap of a double tap lands near the first, but rarely on the same
// pixel — this is the gap allowed between the two.
const DOUBLE_TAP_SLOP_PX = 48;

const distance = (ax: number, ay: number, bx: number, by: number) =>
  Math.hypot(ax - bx, ay - by);

export const useDoubleTap = (
  target: MaybeRefOrGetter<HTMLElement | null | undefined>,
  onDoubleTap: (event: PointerEvent) => void,
) => {
  let downAt = 0;
  let downX = 0;
  let downY = 0;
  let tapAt = 0;
  let tapX = 0;
  let tapY = 0;

  useEventListener(target, "pointerdown", (event: PointerEvent) => {
    if (event.isPrimary === false) return;
    downAt = Date.now();
    downX = event.clientX;
    downY = event.clientY;
  });

  useEventListener(target, "pointerup", (event: PointerEvent) => {
    if (event.isPrimary === false) return;
    const now = Date.now();
    const isTap
      = downAt > 0
        && now - downAt <= TAP_MAX_MS
        && distance(downX, downY, event.clientX, event.clientY) <= TAP_SLOP_PX;
    downAt = 0;
    if (!isTap) {
      tapAt = 0;
      return;
    }

    const isSecondTap
      = tapAt > 0
        && now - tapAt <= DOUBLE_TAP_MS
        && distance(tapX, tapY, event.clientX, event.clientY) <= DOUBLE_TAP_SLOP_PX;
    if (isSecondTap) {
      // Cleared so a third tap starts a new pair instead of firing again.
      tapAt = 0;
      onDoubleTap(event);
      return;
    }

    tapAt = now;
    tapX = event.clientX;
    tapY = event.clientY;
  });
};
