/**
 * Target box that fits `width`×`height` inside a `max`×`max` square without
 * changing the aspect ratio, or `null` when the image already fits and must
 * be left untouched.
 *
 * Sides are rounded but never to zero: an extremely oblong cover keeps a
 * 1px side rather than collapsing into an undrawable canvas.
 */
export const fitWithin = (
  width: number,
  height: number,
  max: number,
): { width: number; height: number } | null => {
  if (width <= max && height <= max) return null;

  const ratio = Math.min(max / width, max / height);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
};
