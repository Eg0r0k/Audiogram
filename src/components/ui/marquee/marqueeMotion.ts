/** Scroll speed of an overflowing line, in CSS px per second. */
export const MARQUEE_SPEED = 30;

/** Rest at the start of every loop, so the beginning of the text can be read. */
export const MARQUEE_PAUSE_MS = 1500;

export interface MarqueeMotion {
  durationMs: number;
  /** Keyframe offset where the rest ends and the travel begins. */
  holdOffset: number;
}

/**
 * One loop moves the line by `distancePx` at a constant speed, so a long and
 * a short title scroll equally fast; the duration follows from the distance.
 */
export const marqueeMotion = (distancePx: number, speedPxS: number, pauseMs: number): MarqueeMotion => {
  const travelMs = (distancePx / speedPxS) * 1000;
  const durationMs = travelMs + pauseMs;
  return { durationMs, holdOffset: durationMs > 0 ? pauseMs / durationMs : 0 };
};
