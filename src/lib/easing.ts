/**
 * Easing curves for scripted animation, so JS-driven motion can use the same
 * shapes as the CSS `--ease-*` tokens instead of an approximation.
 */

/**
 * Builds an easing function from the two control points of a CSS
 * `cubic-bezier(p1x, p1y, p2x, p2y)`.
 *
 * The curve is parametric, so the y for a given progress is not y(progress):
 * progress is an x, and t must be solved for first. Newton's method converges
 * in a few steps for the shallow curves used in UI; the loop bails out on a
 * flat slope, where the division would blow up.
 *
 * `p1x`/`p2x` must stay within [0, 1] (as CSS requires); the y values may
 * overshoot, which is what gives a curve its bounce.
 */
export const cubicBezier = (p1x: number, p1y: number, p2x: number, p2y: number) => {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;
  const xAt = (t: number) => ((ax * t + bx) * t + cx) * t;
  const dxAt = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const yAt = (t: number) => ((ay * t + by) * t + cy) * t;

  return (progress: number) => {
    let t = progress;
    for (let i = 0; i < 5; i++) {
      const slope = dxAt(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= (xAt(t) - progress) / slope;
    }
    return yAt(t);
  };
};

/** The CSS keyword `ease` — cubic-bezier(0.25, 0.1, 0.25, 1). */
export const easeCss = cubicBezier(0.25, 0.1, 0.25, 1);

/** Mirrors `--ease-out` / `--ease-standard` in style.css. */
export const easeOut = cubicBezier(0.23, 1, 0.32, 1);

/** Mirrors `--ease-in-out` in style.css. */
export const easeInOut = cubicBezier(0.77, 0, 0.175, 1);
