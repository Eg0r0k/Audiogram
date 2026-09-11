import { describe, expect, it } from "vitest";
import {
  type FollowEvent,
  type FollowState,
  INITIAL_FOLLOW_STATE,
  isNearCenter,
  reduceFollow,
} from "@/modules/player/lib/lyrics-follow";

const H = 1000;

const run = (events: FollowEvent[], initial: FollowState = INITIAL_FOLLOW_STATE): FollowState =>
  events.reduce(reduceFollow, initial);

describe("isNearCenter", () => {
  it("accepts offsets within 30% of the container height", () => {
    expect(isNearCenter(0.29 * H, H)).toBe(true);
    expect(isNearCenter(-0.29 * H, H)).toBe(true);
  });

  it("rejects offsets beyond 30% of the container height", () => {
    expect(isNearCenter(0.31 * H, H)).toBe(false);
    expect(isNearCenter(-0.31 * H, H)).toBe(false);
  });
});

describe("reduceFollow", () => {
  it("keeps following on programmatic scroll far from the center", () => {
    const state = run([{ type: "scroll", offset: 0.8 * H, clientHeight: H }]);
    expect(state.following).toBe(true);
    expect(state.userScrolling).toBe(false);
    expect(state.direction).toBe("down");
  });

  it("releases follow when the user scrolls the active line away from the center", () => {
    const state = run([
      { type: "userScrollStart" },
      { type: "scroll", offset: 0.8 * H, clientHeight: H },
    ]);
    expect(state.following).toBe(false);
    expect(state.direction).toBe("down");
  });

  it("re-engages follow when the user brings the active line back near the center", () => {
    const state = run([
      { type: "userScrollStart" },
      { type: "scroll", offset: 0.8 * H, clientHeight: H },
      { type: "scroll", offset: -0.1 * H, clientHeight: H },
    ]);
    expect(state.following).toBe(true);
    expect(state.direction).toBe("up");
  });

  it("does not re-engage follow from programmatic scrolls after the user scroll ended", () => {
    const state = run([
      { type: "userScrollStart" },
      { type: "scroll", offset: 0.8 * H, clientHeight: H },
      { type: "scrollEnd" },
      { type: "scroll", offset: 0.05 * H, clientHeight: H },
    ]);
    expect(state.userScrolling).toBe(false);
    expect(state.following).toBe(false);
  });

  it("tracks direction on every scroll even when not following", () => {
    const state = run([
      { type: "userScrollStart" },
      { type: "scroll", offset: 0.8 * H, clientHeight: H },
      { type: "scrollEnd" },
      { type: "scroll", offset: -0.9 * H, clientHeight: H },
    ]);
    expect(state.following).toBe(false);
    expect(state.direction).toBe("up");
  });

  it("resume restores follow and clears user scrolling", () => {
    const state = run([
      { type: "userScrollStart" },
      { type: "scroll", offset: 0.8 * H, clientHeight: H },
      { type: "resume" },
    ]);
    expect(state.following).toBe(true);
    expect(state.userScrolling).toBe(false);
  });

  it("linesChanged resets to the initial state", () => {
    const state = run([
      { type: "userScrollStart" },
      { type: "scroll", offset: -0.8 * H, clientHeight: H },
      { type: "linesChanged" },
    ]);
    expect(state).toEqual(INITIAL_FOLLOW_STATE);
  });
});
