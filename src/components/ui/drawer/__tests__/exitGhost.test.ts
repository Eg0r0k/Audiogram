import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { leaveExitGhosts } from "../exitGhost";

//
// happy-dom has no Web Animations, so each element gets a stand-in close
// animation through a stubbed getAnimations.
//

type FakeAnimation = { playState: AnimationPlayState; startTime: number | null };
const animations = new WeakMap<Element, FakeAnimation[]>();

const sheet = (state: "open" | "closed", animation?: FakeAnimation) => {
  const el = document.createElement("div");
  el.dataset.slot = "drawer-content";
  el.dataset.state = state;
  document.body.append(el);
  if (animation) animations.set(el, [animation]);
  return el;
};

const ghostOf = () => document.body.querySelector<HTMLElement>("[aria-hidden='true'][data-slot='drawer-content']");

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "getAnimations", {
    configurable: true,
    value(this: Element) {
      // A fresh copy gets the running close animation its closed state starts.
      if (!animations.has(this)) animations.set(this, [{ playState: "running", startTime: null }]);
      return animations.get(this);
    },
  });
});

afterAll(() => {
  delete (HTMLElement.prototype as { getAnimations?: unknown }).getAnimations;
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("leaveExitGhosts", () => {
  // The slide runs on the compositor while the page swap blocks the main
  // thread, so the original's start is still unresolved; the copy restarted
  // from the open position and the sheet flashed back up.
  it("starts the copy at the close start when the original's start is unresolved", () => {
    const el = sheet("closed", { playState: "running", startTime: null });

    leaveExitGhosts([el], 1234);

    expect(animations.get(ghostOf()!)?.[0]?.startTime).toBe(1234);
  });

  it("prefers the original's own resolved start", () => {
    const el = sheet("closed", { playState: "running", startTime: 900 });

    leaveExitGhosts([el], 1234);

    expect(animations.get(ghostOf()!)?.[0]?.startTime).toBe(900);
  });

  it("plays a sheet that was still open from the start", () => {
    const el = sheet("open", { playState: "finished", startTime: 10 });

    leaveExitGhosts([el], 1234);

    expect(ghostOf()?.dataset.state).toBe("closed");
    expect(animations.get(ghostOf()!)?.[0]?.startTime).toBeNull();
  });

  it("leaves no copy of a sheet whose close already finished", () => {
    const el = sheet("closed", { playState: "finished", startTime: 10 });

    leaveExitGhosts([el], 1234);

    expect(ghostOf()).toBeNull();
  });
});
