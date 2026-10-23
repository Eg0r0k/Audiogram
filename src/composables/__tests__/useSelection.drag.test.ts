import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, ref, watch } from "vue";
import type { EffectScope, Ref } from "vue";
import { useSelection } from "../useSelection";

const ROW_HEIGHT = 50;
const LONG_PRESS_MS = 450;
const VIEWPORT_HEIGHT = 400;

interface Row {
  id: string;
}

const makeRows = (count: number): Row[] =>
  Array.from({ length: count }, (_, i) => ({ id: `t${i}` }));

const idRange = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, k) => `t${from + k}`).sort();

const rowY = (index: number) => index * ROW_HEIGHT + ROW_HEIGHT / 2;

const appendRows = (container: HTMLElement, count: number) => {
  for (let i = 0; i < count; i++) {
    const row = document.createElement("div");
    row.dataset.selectableId = `t${i}`;
    row.dataset.selectableIndex = String(i);
    container.appendChild(row);
  }
};

const touchEvent = (type: string, x: number, y: number, target: EventTarget): Event => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: type === "touchend" ? [] : [{ clientX: x, clientY: y, target }],
  });
  return event;
};

const watchWrites = (selection: ReturnType<typeof useSelection>) => {
  const counter = { writes: 0 };
  watch(selection.selectedIds, () => {
    counter.writes++;
  }, { flush: "sync" });
  return counter;
};

describe("useSelection drag writes", () => {
  let scope: EffectScope;
  let container: HTMLElement;
  let items: Ref<Row[]>;
  let selection: ReturnType<typeof useSelection>;
  let counter: { writes: number };
  let cleanup: () => void;

  const setup = (rowCount: number, itemCount = rowCount) => {
    container = document.createElement("div");
    appendRows(container, rowCount);
    document.body.appendChild(container);
    vi.spyOn(document, "elementFromPoint").mockImplementation(
      (_x: number, y: number) => container.children[Math.floor(y / ROW_HEIGHT)] ?? null,
    );

    items = ref(makeRows(itemCount));
    scope = effectScope();
    scope.run(() => {
      selection = useSelection(items);
      counter = watchWrites(selection);
    });
    cleanup = selection.attachDragListeners(container);
  };

  const selected = () => [...selection.selectedIds.value].sort();

  const mouseDownOnRow = (index: number) => {
    container.children[index]!.dispatchEvent(new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 10,
      clientY: rowY(index),
    }));
  };
  const mouseMoveTo = (y: number) =>
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 10, clientY: y }));
  const mouseUp = () => window.dispatchEvent(new MouseEvent("mouseup"));

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "vibrate", { value: vi.fn(), configurable: true });
  });

  afterEach(() => {
    cleanup();
    scope.stop();
    container.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("does not rewrite the selection while the pointer stays on the same row", () => {
    setup(5);
    mouseDownOnRow(0);
    mouseMoveTo(rowY(1));
    expect(counter.writes).toBe(1);

    for (const dy of [-20, -10, 0, 10, 20]) mouseMoveTo(rowY(1) + dy);

    expect(counter.writes).toBe(1);
    expect(selected()).toEqual(["t0", "t1"]);
  });

  it("extends the selection when the pointer reaches the next row", () => {
    setup(5);
    mouseDownOnRow(0);
    mouseMoveTo(rowY(1));
    mouseMoveTo(rowY(1) + 20);
    mouseMoveTo(rowY(2));

    expect(selected()).toEqual(["t0", "t1", "t2"]);
    expect(counter.writes).toBe(2);
  });

  it("re-applies the range when the list grows under the same row", () => {
    setup(5, 3);
    mouseDownOnRow(0);
    mouseMoveTo(rowY(4));
    expect(selected()).toEqual(["t0", "t1", "t2"]);

    items.value = makeRows(5);
    mouseMoveTo(rowY(4) + 10);

    expect(selected()).toEqual(["t0", "t1", "t2", "t3", "t4"]);
  });

  it("shrinks back to the start row when the pointer returns to it", () => {
    setup(5);
    mouseDownOnRow(1);
    mouseMoveTo(rowY(3));
    mouseMoveTo(rowY(1));

    expect(selected()).toEqual(["t1"]);
  });

  it("flips the range when the pointer crosses back over the start row", () => {
    setup(5);
    mouseDownOnRow(2);
    mouseMoveTo(rowY(3));
    mouseMoveTo(rowY(0));

    expect(selected()).toEqual(["t0", "t1", "t2"]);
  });

  it("a long-press on the row where the previous drag ended still applies", () => {
    setup(5);
    mouseDownOnRow(0);
    mouseMoveTo(rowY(2));
    mouseUp();
    expect(selected()).toEqual(["t0", "t1", "t2"]);

    const row = container.children[2]!;
    container.dispatchEvent(touchEvent("touchstart", 10, rowY(2), row));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    row.dispatchEvent(touchEvent("touchend", 0, 0, row));
    vi.advanceTimersByTime(400);

    expect(selected()).toEqual(["t0", "t1"]);
  });
});

describe("useSelection drag writes during autoscroll", () => {
  let scope: EffectScope;
  let container: HTMLElement;
  let selection: ReturnType<typeof useSelection>;
  let counter: { writes: number };
  let cleanup: () => void;
  let rafCallbacks: Map<number, FrameRequestCallback>;
  let rafId: number;
  let gestureNode: Element;

  const flushFrames = (count: number) => {
    for (let i = 0; i < count; i++) {
      const pending = [...rafCallbacks.entries()];
      rafCallbacks.clear();
      pending.forEach(([, cb]) => cb(performance.now()));
    }
  };

  const longPressRow = (index: number) => {
    gestureNode = container.children[index]!;
    container.dispatchEvent(touchEvent("touchstart", 10, rowY(index) - container.scrollTop, gestureNode));
    vi.advanceTimersByTime(LONG_PRESS_MS);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    rafCallbacks = new Map();
    rafId = 0;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafCallbacks.set(++rafId, cb);
      return rafId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => rafCallbacks.delete(id));
    Object.defineProperty(navigator, "vibrate", { value: vi.fn(), configurable: true });

    container = document.createElement("div");
    container.style.overflowY = "auto";
    Object.defineProperty(container, "scrollHeight", { value: 40 * ROW_HEIGHT, configurable: true });
    Object.defineProperty(container, "clientHeight", { value: VIEWPORT_HEIGHT, configurable: true });
    container.getBoundingClientRect = () =>
      ({ top: 0, bottom: VIEWPORT_HEIGHT, left: 0, right: 300, width: 300, height: VIEWPORT_HEIGHT, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    appendRows(container, 40);
    document.body.appendChild(container);
    vi.spyOn(document, "elementFromPoint").mockImplementation(
      (_x: number, y: number) =>
        container.children[Math.floor((y + container.scrollTop) / ROW_HEIGHT)] ?? null,
    );

    scope = effectScope();
    scope.run(() => {
      selection = useSelection(ref(makeRows(40)));
      counter = watchWrites(selection);
    });
    cleanup = selection.attachDragListeners(container);
  });

  afterEach(() => {
    cleanup();
    scope.stop();
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("autoscroll writes the selection only when a new row comes under the finger", () => {
    const fingerY = VIEWPORT_HEIGHT - 10;
    const rowUnderFinger = () => Math.floor((fingerY + container.scrollTop) / ROW_HEIGHT);

    longPressRow(0);
    gestureNode.dispatchEvent(touchEvent("touchmove", 10, fingerY, gestureNode));
    const startRow = rowUnderFinger();
    counter.writes = 0;

    flushFrames(10);

    const endRow = rowUnderFinger();
    expect(endRow).toBeGreaterThan(startRow);
    expect(counter.writes).toBe(endRow - startRow);
    expect([...selection.selectedIds.value].sort()).toEqual(idRange(0, endRow));
  });
});
