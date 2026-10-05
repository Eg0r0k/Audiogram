import { describe, expect, it } from "vitest";
import { mixWithBlack, parseCssRgb } from "../color-mix";

describe("parseCssRgb", () => {
  it("reads hex and the palette's hsl()", () => {
    expect(parseCssRgb("#3366cc")).toEqual({ r: 0x33, g: 0x66, b: 0xcc });
    expect(parseCssRgb("hsl(0, 0%, 21%)")).toEqual({ r: 54, g: 54, b: 54 });
    expect(parseCssRgb("hsl(120, 100%, 50%)")).toEqual({ r: 0, g: 255, b: 0 });
  });

  it("returns null for other syntaxes", () => {
    expect(parseCssRgb("rebeccapurple")).toBeNull();
  });
});

describe("mixWithBlack", () => {
  it("emits color-mix() where the engine has it", () => {
    expect(mixWithBlack("#3366cc", 0.8, true)).toBe("color-mix(in oklch, #3366cc 80%, black)");
  });

  it("computes the same mix in oklch where it does not (WebView < 111)", () => {
    expect(mixWithBlack("#ffffff", 0.5, false)).toBe("#636363");
    expect(mixWithBlack("hsl(0, 0%, 100%)", 0.5, false)).toBe("#636363");
  });

  it("leaves a colour it cannot read as it is", () => {
    expect(mixWithBlack("rebeccapurple", 0.5, false)).toBe("rebeccapurple");
  });
});
