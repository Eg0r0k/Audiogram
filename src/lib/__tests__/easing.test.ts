import { describe, expect, it } from "vitest";
import { cubicBezier, easeCss, easeInOut, easeOut } from "../easing";

const linear = cubicBezier(0, 0, 1, 1);

describe("cubicBezier", () => {
  it("pins both ends", () => {
    for (const curve of [easeCss, easeOut, easeInOut, linear]) {
      expect(curve(0)).toBeCloseTo(0, 5);
      expect(curve(1)).toBeCloseTo(1, 5);
    }
  });

  it("reproduces a linear curve", () => {
    expect(linear(0.25)).toBeCloseTo(0.25, 4);
    expect(linear(0.5)).toBeCloseTo(0.5, 4);
    expect(linear(0.75)).toBeCloseTo(0.75, 4);
  });

  it("matches the browser's `ease` at its midpoint", () => {
    // cubic-bezier(0.25, 0.1, 0.25, 1) is ~80% done halfway through.
    expect(easeCss(0.5)).toBeCloseTo(0.802, 2);
  });

  it("front-loads an ease-out curve", () => {
    expect(easeOut(0.25)).toBeGreaterThan(0.6);
    expect(easeOut(0.5)).toBeGreaterThan(0.85);
  });

  it("holds an ease-in-out curve back at the start, then lets it run", () => {
    // Not symmetric: the x controls (0.77 / 0.175) put the midpoint past half.
    expect(easeInOut(0.25)).toBeLessThan(0.15);
    expect(easeInOut(0.5)).toBeGreaterThan(0.5);
    expect(easeInOut(0.75)).toBeGreaterThan(0.9);
  });

  it("rises monotonically", () => {
    for (const curve of [easeCss, easeOut, easeInOut]) {
      let previous = -Infinity;
      for (let p = 0; p <= 1; p += 0.05) {
        const value = curve(p);
        expect(value).toBeGreaterThanOrEqual(previous);
        previous = value;
      }
    }
  });

  it("lets a bounce curve overshoot past 1", () => {
    // --ease-bounce in style.css.
    const bounce = cubicBezier(0.34, 1.56, 0.64, 1);
    const peak = Math.max(...Array.from({ length: 21 }, (_, i) => bounce(i / 20)));
    expect(peak).toBeGreaterThan(1);
  });
});
