import { createApp, defineComponent, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDragReorder } from "../composables/useDragReorder";

interface DragHarness {
  isDragging: { value: boolean };
  dragIndex: { value: number };
  dropIndex: { value: number };
  ghostTop: { value: number };
  startDrag: (index: number, event: PointerEvent) => void;
}

function withSetup<T>(composable: () => T): [T, ReturnType<typeof createApp>] {
  let result!: T;

  const app = createApp(defineComponent({
    setup() {
      result = composable();
      return () => null;
    },
  }));

  app.mount(document.createElement("div"));

  return [result, app];
}

function createPointerEvent(type: string, clientY: number): Event {
  const event = new Event(type, { bubbles: true });

  Object.defineProperties(event, {
    clientY: { value: clientY },
    pointerId: { value: 1 },
  });

  return event;
}

function createStartEvent(clientY: number, rowTop?: number, rowHeight = 64): PointerEvent {
  const target = {
    setPointerCapture: vi.fn(),
    closest: vi.fn(() => {
      if (rowTop === undefined) return null;

      return {
        getBoundingClientRect: () => ({
          top: rowTop,
          bottom: rowTop + rowHeight,
          left: 0,
          right: 300,
          width: 300,
          height: rowHeight,
          x: 0,
          y: rowTop,
          toJSON: () => ({}),
        }) as DOMRect,
      };
    }),
  };

  return {
    clientY,
    pointerId: 1,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    target,
  } as unknown as PointerEvent;
}

function createContainer(top = 100) {
  const container = document.createElement("div");
  container.scrollTop = 0;
  container.getBoundingClientRect = () => ({
    top,
    bottom: top + 400,
    left: 0,
    right: 300,
    width: 300,
    height: 400,
    x: 0,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

  return container;
}

describe("useDragReorder", () => {
  let app: ReturnType<typeof createApp> | null = null;

  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    app?.unmount();
    app = null;
    vi.unstubAllGlobals();
  });

  it("accounts for the before-slot offset when calculating the drop target", () => {
    const container = createContainer();

    const [drag, mountedApp] = withSetup(() => useDragReorder({
      itemCount: ref(4),
      itemHeight: 64,
      getScrollContainer: () => container,
      getListStartOffset: () => 96,
      onReorder: vi.fn(),
    }));

    app = mountedApp;

    drag.startDrag(0, createStartEvent(196));
    document.dispatchEvent(createPointerEvent("pointermove", 206));

    expect(drag.isDragging.value).toBe(true);
    expect(drag.dropIndex.value).toBe(0);
  });

  it("reorders down by one when the dragged row top reaches the next slot", () => {
    const container = createContainer();
    const onReorder = vi.fn();

    const [drag, mountedApp] = withSetup(() => useDragReorder({
      itemCount: ref(4),
      itemHeight: 64,
      getScrollContainer: () => container,
      onReorder,
    }));

    app = mountedApp;

    drag.startDrag(0, createStartEvent(110));
    document.dispatchEvent(createPointerEvent("pointermove", 196));
    document.dispatchEvent(createPointerEvent("pointerup", 196));

    expect(onReorder).toHaveBeenCalledWith(0, 1);
  });

  it("uses the dragged row top rather than the raw pointer position", () => {
    const container = createContainer();
    const onReorder = vi.fn();

    const [drag, mountedApp] = withSetup(() => useDragReorder({
      itemCount: ref(4),
      itemHeight: 64,
      getScrollContainer: () => container,
      onReorder,
    }));

    app = mountedApp;

    drag.startDrag(0, createStartEvent(104, 100));
    document.dispatchEvent(createPointerEvent("pointermove", 168));
    document.dispatchEvent(createPointerEvent("pointerup", 168));

    expect(onReorder).toHaveBeenCalledWith(0, 1);
  });

  it("keeps the drag overlay aligned with the dragged row top", () => {
    const container = createContainer();

    const [drag, mountedApp] = withSetup(() => useDragReorder({
      itemCount: ref(4),
      itemHeight: 64,
      getScrollContainer: () => container,
      onReorder: vi.fn(),
    }));

    app = mountedApp;

    drag.startDrag(0, createStartEvent(124, 100));
    document.dispatchEvent(createPointerEvent("pointermove", 180));

    expect(drag.ghostTop.value).toBe(156);
  });

  it("does not let the drag overlay move above the first draggable row", () => {
    const container = createContainer();

    const [drag, mountedApp] = withSetup(() => useDragReorder({
      itemCount: ref(4),
      itemHeight: 64,
      getScrollContainer: () => container,
      getListStartOffset: () => 96,
      onReorder: vi.fn(),
    }));

    app = mountedApp;

    drag.startDrag(2, createStartEvent(389, 356));
    document.dispatchEvent(createPointerEvent("pointermove", 96));

    expect(drag.ghostTop.value).toBe(196);
  });

  it("reorders up by one when the dragged row top reaches the previous slot", () => {
    const container = createContainer();
    const onReorder = vi.fn();

    const [drag, mountedApp] = withSetup(() => useDragReorder({
      itemCount: ref(4),
      itemHeight: 64,
      getScrollContainer: () => container,
      onReorder,
    }));

    app = mountedApp;

    drag.startDrag(3, createStartEvent(330));
    document.dispatchEvent(createPointerEvent("pointermove", 228));
    document.dispatchEvent(createPointerEvent("pointerup", 228));

    expect(onReorder).toHaveBeenCalledWith(3, 2);
  });

  it("allows dropping at the end of the list", () => {
    const container = createContainer();
    const onReorder = vi.fn();

    const [drag, mountedApp] = withSetup(() => useDragReorder({
      itemCount: ref(4),
      itemHeight: 64,
      getScrollContainer: () => container,
      onReorder,
    }));

    app = mountedApp;

    drag.startDrag(0, createStartEvent(110));
    document.dispatchEvent(createPointerEvent("pointermove", 356));
    document.dispatchEvent(createPointerEvent("pointerup", 356));

    expect(onReorder).toHaveBeenCalledWith(0, 3);
  });
});
