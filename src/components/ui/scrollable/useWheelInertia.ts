import type { Ref } from "vue";

export const WHEEL_INERTIA_ENABLED: boolean = true;

// How long a notch keeps drifting: the remaining distance decays with this
// time constant, so ~95% of the travel is done after three of them.
const TIME_CONSTANT_MS = 110;
const LINE_HEIGHT_PX = 40;

// The web build zooms through CSS `zoom` on <html>; Tauri zooms the webview
// natively, which only shows up in devicePixelRatio.
const cssZoom = (): number => {
  const zoom = Number.parseFloat(document.documentElement.style.zoom);
  return Number.isFinite(zoom) && zoom > 0 ? zoom / 100 : 1;
};

// Chromium reports a mouse notch as whole device pixels (100 or more per
// click) and divides them by the page zoom, so 110% turns a notch into
// 90.909 CSS px; scaling back recovers the whole number. A trackpad sends
// small fractional deltas at a high rate and carries its own inertia, so it
// is left to the browser.
const isWheelNotch = (event: WheelEvent): boolean => {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return true;
  const devicePixels = Math.abs(event.deltaY) * window.devicePixelRatio * cssZoom();
  return devicePixels >= 40 && Math.abs(devicePixels - Math.round(devicePixels)) < 0.01;
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const useWheelInertia = (containerRef: Ref<HTMLElement | null>, isLocked: () => boolean) => {
  let frame = 0;
  let target = 0;
  let position = 0;
  let lastApplied = 0;
  let lastTime = 0;

  const stop = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };

  const step = (now: number) => {
    const container = containerRef.value;
    if (!container) {
      stop();
      return;
    }
    // Someone else moved the scroller (thumb drag, programmatic scrollTo):
    // the drift must not fight it.
    if (Math.abs(container.scrollTop - lastApplied) > 1) {
      stop();
      return;
    }

    const dt = Math.min(now - lastTime, 64);
    lastTime = now;
    const remaining = target - position;
    if (Math.abs(remaining) < 0.5) {
      container.scrollTop = target;
      stop();
      return;
    }

    position += remaining * (1 - Math.exp(-dt / TIME_CONSTANT_MS));
    container.scrollTop = position;
    lastApplied = container.scrollTop;
    frame = requestAnimationFrame(step);
  };

  const onWheel = (event: WheelEvent) => {
    if (event.defaultPrevented || event.ctrlKey || event.shiftKey || isLocked()) return;
    if (!isWheelNotch(event) || prefersReducedMotion()) return;
    const container = containerRef.value;
    if (!container) return;

    const max = container.scrollHeight - container.clientHeight;
    if (max <= 0) return;

    const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? event.deltaY * LINE_HEIGHT_PX
      : event.deltaY;

    // A fresh gesture starts from where the scroller really is; notches that
    // arrive while a drift is running stack onto its target instead.
    if (!frame) {
      position = container.scrollTop;
      target = position;
    }
    const next = Math.max(0, Math.min(max, target + delta));
    if (next === target) {
      // The target already sits at the edge. While the drift is still on its
      // way there the browser must not take the notch, or it lands the
      // scroller on the edge in one frame; once parked there the event is
      // left alone and `overscroll-behavior: contain` keeps it from chaining.
      if (frame) event.preventDefault();
      return;
    }

    event.preventDefault();
    target = next;
    if (!frame) {
      lastApplied = container.scrollTop;
      lastTime = performance.now();
      frame = requestAnimationFrame(step);
    }
  };

  return { onWheel, cancel: stop };
};
