import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, type EffectScope } from "vue";
import { useDoubleTap } from "../useDoubleTap";

// happy-dom's PointerEvent drops clientX/clientY, so the coordinates are
// pinned onto a plain Event instead.
const pointerEvent = (type: string, x: number, y: number): Event => {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, "clientX", { value: x });
  Object.defineProperty(event, "clientY", { value: y });
  Object.defineProperty(event, "isPrimary", { value: true });
  return event;
};

describe("useDoubleTap", () => {
  let target: HTMLElement;
  let scope: EffectScope;
  let onDoubleTap: ReturnType<typeof vi.fn>;

  const tap = (x = 100, y = 100, { holdMs = 30, upX = x, upY = y } = {}) => {
    target.dispatchEvent(pointerEvent("pointerdown", x, y));
    vi.advanceTimersByTime(holdMs);
    target.dispatchEvent(pointerEvent("pointerup", upX, upY));
  };

  beforeEach(() => {
    vi.useFakeTimers();
    target = document.createElement("div");
    document.body.appendChild(target);
    onDoubleTap = vi.fn();
    scope = effectScope();
    scope.run(() => useDoubleTap(target, onDoubleTap));
  });

  afterEach(() => {
    scope.stop();
    target.remove();
    vi.useRealTimers();
  });

  it("fires on two quick taps in the same spot", () => {
    tap();
    vi.advanceTimersByTime(120);
    tap();
    expect(onDoubleTap).toHaveBeenCalledTimes(1);
  });

  it("ignores taps spaced further apart than the double-tap window", () => {
    tap();
    vi.advanceTimersByTime(600);
    tap();
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it("ignores a second tap that lands far from the first", () => {
    tap(100, 100);
    vi.advanceTimersByTime(120);
    tap(300, 100);
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it("ignores a swipe between two taps", () => {
    tap();
    vi.advanceTimersByTime(120);
    tap(100, 100, { upX: 260 });
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it("ignores a long press", () => {
    tap();
    vi.advanceTimersByTime(120);
    tap(100, 100, { holdMs: 600 });
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it("needs a fresh pair for a second fire, so a triple tap likes once", () => {
    tap();
    vi.advanceTimersByTime(120);
    tap();
    vi.advanceTimersByTime(120);
    tap();
    expect(onDoubleTap).toHaveBeenCalledTimes(1);
  });
});
