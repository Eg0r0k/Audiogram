/**
 * The compositor draws a frame whenever any animated value changes, so
 * stepped animations that change on their own phases add up to the display
 * rate. Durations, delays and start times in whole ticks of this grid make
 * them all change on the same frames: at most 60 a second.
 */
export const FRAME_GRID_MS = 1000 / 60;

// Grid arithmetic in doubles lands a hair off whole ticks (3 ticks is
// 49.99999999 ms); this much slack keeps such values where they are.
const TICK_EPSILON = 1e-6;

export type GridDirection = "forward" | "back";

/** `ms` as whole ticks, at least one: a step count. */
export const gridTicks = (ms: number): number => Math.max(1, Math.round(ms / FRAME_GRID_MS));

/** `ms` rounded to whole ticks; zero stays zero. */
export const toGrid = (ms: number): number => Math.round(ms / FRAME_GRID_MS) * FRAME_GRID_MS;

/** The nearest grid point at or after (`forward`) or at or before (`back`) `time`. */
export const snapToGrid = (time: number, direction: GridDirection = "forward"): number => {
  const ticks = time / FRAME_GRID_MS;
  const whole = direction === "forward" ? Math.ceil(ticks - TICK_EPSILON) : Math.floor(ticks + TICK_EPSILON);
  return whole * FRAME_GRID_MS;
};

/** The document timeline's time snapped forward, or null when it has none. */
export const gridNow = (doc: Document): number | null => {
  // Typed non-null, but absent outside browsers (happy-dom).
  const timeline = doc.timeline as DocumentTimeline | undefined;
  const now = timeline?.currentTime;
  return typeof now === "number" ? snapToGrid(now) : null;
};

/** Moves the animation's start onto the grid once it has one; paused or cancelled animations are left alone. */
export const alignToGrid = async (animation: Animation, direction: GridDirection = "forward"): Promise<void> => {
  try {
    await animation.ready;
  }
  catch {
    return;
  }
  const start = animation.startTime;
  if (typeof start === "number") animation.startTime = snapToGrid(start, direction);
};
