import { describe, expect, it } from "vitest";
import { FRAME_GRID_MS, alignToGrid, gridNow, gridTicks, snapToGrid, toGrid } from "../frame-grid";

describe("frame grid", () => {
  it("ticks 60 times a second", () => {
    expect(FRAME_GRID_MS).toBeCloseTo(1000 / 60);
  });

  it("counts whole ticks, never fewer than one", () => {
    expect(gridTicks(1000)).toBe(60);
    expect(gridTicks(25)).toBe(2);
    expect(gridTicks(0)).toBe(1);
  });

  it("rounds a duration to whole ticks, zero allowed", () => {
    expect(toGrid(0)).toBe(0);
    expect(toGrid(1500) / FRAME_GRID_MS).toBeCloseTo(90);
    expect(toGrid(1010) / FRAME_GRID_MS).toBeCloseTo(61);
  });

  it("snaps a time forward or back to a grid point", () => {
    expect(snapToGrid(1000.5) / FRAME_GRID_MS).toBeCloseTo(61);
    expect(snapToGrid(1000.5, "back") / FRAME_GRID_MS).toBeCloseTo(60);
  });

  it("keeps a time already on the grid where it is despite float error", () => {
    const point = 3 * FRAME_GRID_MS;
    expect(snapToGrid(point)).toBeCloseTo(point);
    expect(snapToGrid(point, "back")).toBeCloseTo(point);
  });

  it("reads the document timeline snapped forward, or null without one", () => {
    expect(gridNow({ timeline: { currentTime: 1000.5 } } as unknown as Document)! / FRAME_GRID_MS).toBeCloseTo(61);
    expect(gridNow({ timeline: { currentTime: null } } as unknown as Document)).toBeNull();
    expect(gridNow({} as Document)).toBeNull();
  });

  it("moves a started animation onto the grid once it is ready", async () => {
    const animation = { ready: Promise.resolve(), startTime: 1000.5 } as unknown as Animation;
    await alignToGrid(animation);
    expect((animation.startTime as number) / FRAME_GRID_MS).toBeCloseTo(61);
  });

  it("leaves an animation without a start time, or a cancelled one, alone", async () => {
    const paused = { ready: Promise.resolve(), startTime: null } as unknown as Animation;
    await alignToGrid(paused);
    expect(paused.startTime).toBeNull();

    const cancelled = { ready: Promise.reject(new DOMException("aborted", "AbortError")), startTime: 5 } as unknown as Animation;
    await expect(alignToGrid(cancelled)).resolves.toBeUndefined();
    expect(cancelled.startTime).toBe(5);
  });
});
