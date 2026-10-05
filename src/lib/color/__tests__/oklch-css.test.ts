import { describe, expect, it } from "vitest";
import { oklchCssToHex, rgbToOklch } from "../color";

describe("oklchCssToHex", () => {
  it("converts an in-gamut colour back to its hex", () => {
    const { L, C, h } = rgbToOklch(0x33, 0x66, 0xcc);
    expect(oklchCssToHex(`oklch(${L} ${C} ${h})`)).toBe("#3366cc");
  });

  it("reads lightness given as a percentage", () => {
    expect(oklchCssToHex("oklch(100% 0 0)")).toBe("#ffffff");
    expect(oklchCssToHex("oklch(0% 0 0)")).toBe("#000000");
  });

  it("brings an out-of-gamut chroma into sRGB instead of clipping channels", () => {
    expect(oklchCssToHex("oklch(0.7 0.4 150)")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("returns null for anything but oklch()", () => {
    expect(oklchCssToHex("#ffffff")).toBeNull();
    expect(oklchCssToHex("oklch(var(--x) 0 0)")).toBeNull();
  });
});
