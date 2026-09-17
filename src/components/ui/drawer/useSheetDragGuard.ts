const DRAG_SLOP_PX = 8;

interface Press {
  id: number;
  x: number;
  y: number;
}

interface Touch {
  y: number;
  scroller: HTMLElement | null;
  owned: boolean | null;
}

const isScroller = (el: HTMLElement) => {
  if (el.scrollHeight <= el.clientHeight) return false;
  const overflow = getComputedStyle(el).overflowY;
  return overflow === "auto" || overflow === "scroll" || overflow === "overlay";
};

const findScroller = (from: EventTarget | null, root: EventTarget | null) => {
  let el = from instanceof HTMLElement ? from : null;
  while (el && el !== root) {
    if (isScroller(el)) return el;
    el = el.parentElement;
  }
  return null;
};

/**
 * Capture-phase pointer and touch handlers for the sheet root, so a sheet
 * that drags from anywhere still has rows that behave like plain buttons and
 * a nested scroller that still scrolls.
 *
 * vaul captures the pointer on the pressed element, so the `click` after a
 * drag lands on the row under the finger; it is stopped before the row sees
 * it. The flag is reset on the next press, since a touch drag produces no
 * click at all and must not swallow the tap that follows.
 *
 * The browser owns touches inside a scroller and would start a scroll
 * gesture (and cancel the pointer) even for a downward pull at the top of
 * the list, where vaul should drag the sheet instead. The first `touchmove`
 * decides once per touch: a downward move with the touched scroller at its
 * top (or no scroller at all) is prevented for the rest of the gesture, so
 * pointer events keep flowing to vaul; anything else stays native. This is
 * done per gesture rather than by switching `touch-action`, which Chromium
 * does not re-read once the scroller has been painted.
 *
 * vaul-vue binds no `pointercancel`, so a gesture the browser did take
 * would leave its drag state set until the next press. A synthetic
 * `pointerup` at the press point runs vaul's release with zero distance and
 * zero velocity: reset, no close, no move.
 */
export const useSheetDragGuard = () => {
  let press: Press | null = null;
  let dragged = false;
  let touch: Touch | null = null;

  const onPointerdown = (event: PointerEvent) => {
    press = { id: event.pointerId, x: event.clientX, y: event.clientY };
    dragged = false;
  };

  const onPointerup = (event: PointerEvent) => {
    if (press && press.id === event.pointerId) {
      dragged = Math.hypot(event.clientX - press.x, event.clientY - press.y) > DRAG_SLOP_PX;
    }
    press = null;
  };

  const onPointercancel = (event: PointerEvent) => {
    if (!press || press.id !== event.pointerId) return;
    const { x, y } = press;
    press = null;
    event.target?.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      clientX: x,
      clientY: y,
    }));
  };

  const onClick = (event: MouseEvent) => {
    if (!dragged) return;
    dragged = false;
    event.stopPropagation();
    event.preventDefault();
  };

  const onTouchstart = (event: TouchEvent) => {
    if (event.touches.length !== 1) {
      touch = null;
      return;
    }
    touch = {
      y: event.touches[0].clientY,
      scroller: findScroller(event.target, event.currentTarget),
      owned: null,
    };
  };

  const onTouchmove = (event: TouchEvent) => {
    if (!touch || event.touches.length !== 1) return;
    if (touch.owned === null) {
      const dy = event.touches[0].clientY - touch.y;
      if (dy === 0) return;
      touch.owned = dy > 0 && (!touch.scroller || touch.scroller.scrollTop === 0);
    }
    if (touch.owned && event.cancelable) event.preventDefault();
  };

  const onTouchend = () => {
    touch = null;
  };

  return {
    onPointerdown,
    onPointerup,
    onPointercancel,
    onClick,
    onTouchstart,
    onTouchmove,
    onTouchend,
  };
};
