import { describe, expect, it } from "vitest";
import { MARQUEE_PAUSE_MS, MARQUEE_SPEED, marqueeMotion } from "../marqueeMotion";
import { FRAME_GRID_MS } from "@/lib/frame-grid";

describe("marqueeMotion", () => {
  it("travels the distance at the given speed in px/s, plus the pause", () => {
    const motion = marqueeMotion(300, 30, 1500);

    expect(motion.durationMs).toBeCloseTo(10_000 + 1500);
  });

  it("holds still for the pause at the start of every loop", () => {
    const motion = marqueeMotion(300, 30, 1500);

    expect(motion.holdOffset).toBeCloseTo(1500 / 11_500);
  });

  it("keeps the same speed for a short and a long title", () => {
    const short = marqueeMotion(150, MARQUEE_SPEED, 0);
    const long = marqueeMotion(600, MARQUEE_SPEED, 0);

    expect(150 / short.durationMs).toBeCloseTo(600 / long.durationMs);
  });

  it("defaults to a readable speed and a visible pause", () => {
    expect(MARQUEE_SPEED).toBeGreaterThanOrEqual(20);
    expect(MARQUEE_SPEED).toBeLessThanOrEqual(60);
    expect(MARQUEE_PAUSE_MS).toBeGreaterThan(0);
  });

  it("travels and rests in whole grid ticks, one step per tick", () => {
    // 100 px at 35 px/s is 171.43 ticks of travel.
    const motion = marqueeMotion(100, 35, 1500);

    expect(motion.steps).toBe(171);
    expect(motion.durationMs / FRAME_GRID_MS).toBeCloseTo(171 + 90);
    expect(motion.holdOffset * motion.durationMs / FRAME_GRID_MS).toBeCloseTo(90);
  });

  it("rests for no time when there is no pause", () => {
    const motion = marqueeMotion(300, 30, 0);

    expect(motion.holdOffset).toBe(0);
  });
});
