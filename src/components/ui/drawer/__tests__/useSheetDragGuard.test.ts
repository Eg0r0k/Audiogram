import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSheetDragGuard } from "../useSheetDragGuard";

// happy-dom has no PointerEvent; a MouseEvent carrying the pointer fields is
// enough for the guard, which only reads pointerId and the client point.
class FakePointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? "touch";
  }
}
vi.stubGlobal("PointerEvent", FakePointerEvent);

const mount = () => {
  const root = document.createElement("div");
  const button = document.createElement("button");
  root.append(button);
  document.body.append(root);

  const guard = useSheetDragGuard();
  root.addEventListener("pointerdown", guard.onPointerdown, true);
  root.addEventListener("pointerup", guard.onPointerup, true);
  root.addEventListener("pointercancel", guard.onPointercancel, true);
  root.addEventListener("click", guard.onClick, true);

  const clicked = vi.fn();
  button.addEventListener("click", clicked);
  const released = vi.fn();
  root.addEventListener("pointerup", released);

  const fire = (type: string, init: PointerEventInit = {}) =>
    button.dispatchEvent(new FakePointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, ...init }));

  return { button, clicked, released, fire };
};

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("useSheetDragGuard", () => {
  it("swallows the click that follows a drag", () => {
    const { clicked, fire } = mount();

    fire("pointerdown", { clientX: 10, clientY: 100 });
    fire("pointerup", { clientX: 10, clientY: 130 });
    fire("click", { clientX: 10, clientY: 130 });

    expect(clicked).not.toHaveBeenCalled();
  });

  it("lets a tap through", () => {
    const { clicked, fire } = mount();

    fire("pointerdown", { clientX: 10, clientY: 100 });
    fire("pointerup", { clientX: 12, clientY: 103 });
    fire("click", { clientX: 12, clientY: 103 });

    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it("does not swallow the tap after a drag whose click never came", () => {
    const { clicked, fire } = mount();

    fire("pointerdown", { clientX: 10, clientY: 100 });
    fire("pointerup", { clientX: 10, clientY: 160 });

    fire("pointerdown", { clientX: 10, clientY: 100 });
    fire("pointerup", { clientX: 10, clientY: 100 });
    fire("click", { clientX: 10, clientY: 100 });

    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it("turns a pointercancel into a pointerup at the press point", () => {
    const { released, fire } = mount();

    fire("pointerdown", { clientX: 10, clientY: 100 });
    fire("pointercancel", { clientX: 10, clientY: 60 });

    expect(released).toHaveBeenCalledTimes(1);
    const event = released.mock.calls[0][0] as PointerEvent;
    expect(event.clientY).toBe(100);
    expect(event.pointerId).toBe(1);
  });

  it("ignores a pointercancel for a pointer it did not see pressed", () => {
    const { released, fire } = mount();

    fire("pointercancel", { pointerId: 7, clientX: 10, clientY: 60 });

    expect(released).not.toHaveBeenCalled();
  });
});

// happy-dom has no TouchEvent either; a cancelable Event with a `touches`
// list carries what the guard reads.
const mountTouch = ({ scrollTop, scrollable }: { scrollTop: number; scrollable: boolean }) => {
  const root = document.createElement("div");
  const scroller = document.createElement("div");
  scroller.style.overflowY = "auto";
  Object.defineProperty(scroller, "scrollHeight", { value: scrollable ? 400 : 100 });
  Object.defineProperty(scroller, "clientHeight", { value: 100 });
  scroller.scrollTop = scrollTop;
  const row = document.createElement("button");
  scroller.append(row);
  root.append(scroller);
  document.body.append(root);

  const guard = useSheetDragGuard();
  root.addEventListener("touchstart", guard.onTouchstart, true);
  root.addEventListener("touchmove", guard.onTouchmove, true);
  root.addEventListener("touchend", guard.onTouchend, true);

  const fire = (type: string, y: number) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "touches", { value: type === "touchend" ? [] : [{ clientY: y }] });
    row.dispatchEvent(event);
    return event.defaultPrevented;
  };

  return { fire };
};

describe("useSheetDragGuard touches", () => {
  it("keeps a downward pull at the top of the list away from the browser", () => {
    const { fire } = mountTouch({ scrollTop: 0, scrollable: true });

    fire("touchstart", 100);

    expect(fire("touchmove", 110)).toBe(true);
    expect(fire("touchmove", 90)).toBe(true);
  });

  it("leaves an upward move to the scroller", () => {
    const { fire } = mountTouch({ scrollTop: 0, scrollable: true });

    fire("touchstart", 100);

    expect(fire("touchmove", 90)).toBe(false);
    expect(fire("touchmove", 120)).toBe(false);
  });

  it("leaves a downward move on a scrolled list to the scroller", () => {
    const { fire } = mountTouch({ scrollTop: 40, scrollable: true });

    fire("touchstart", 100);

    expect(fire("touchmove", 120)).toBe(false);
  });

  it("owns a downward pull when nothing under the finger scrolls", () => {
    const { fire } = mountTouch({ scrollTop: 0, scrollable: false });

    fire("touchstart", 100);

    expect(fire("touchmove", 120)).toBe(true);
  });

  it("decides again for the next touch", () => {
    const { fire } = mountTouch({ scrollTop: 0, scrollable: true });

    fire("touchstart", 100);
    fire("touchmove", 90);
    fire("touchend", 90);
    fire("touchstart", 100);

    expect(fire("touchmove", 120)).toBe(true);
  });
});
