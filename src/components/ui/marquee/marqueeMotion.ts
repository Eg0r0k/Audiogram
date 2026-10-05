import { FRAME_GRID_MS, gridTicks, toGrid } from "@/lib/frame-grid";

/** Scroll speed of an overflowing line, in CSS px per second. */
export const MARQUEE_SPEED = 30;

/** Rest at the start of every loop, so the beginning of the text can be read. */
export const MARQUEE_PAUSE_MS = 1500;

export interface MarqueeMotion {
  durationMs: number;
  /** Keyframe offset where the rest ends and the travel begins. */
  holdOffset: number;
  /** Position updates in one loop: one per grid tick of travel. */
  steps: number;
}

/**
 * One loop moves the line by `distancePx` at a constant speed, so a long and
 * a short title scroll equally fast. Travel and rest are whole grid ticks
 * (see frame-grid.ts), so every line steps on the same frames. Sliding by
 * fractions of a pixel redrew the line on every display frame (120-144/s);
 * whole pixels at 30/s looked torn.
 */
export const marqueeMotion = (distancePx: number, speedPxS: number, pauseMs: number): MarqueeMotion => {
  const steps = gridTicks((distancePx / speedPxS) * 1000);
  const restMs = toGrid(pauseMs);
  const durationMs = steps * FRAME_GRID_MS + restMs;
  return { durationMs, holdOffset: durationMs > 0 ? restMs / durationMs : 0, steps };
};
