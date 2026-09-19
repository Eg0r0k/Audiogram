import { describe, expect, it } from "vitest";
import {
  DEFAULT_FONT_ID,
  FONT_IDS,
  FONT_PRESETS,
  fontPreviewStack,
  isFontId,
  resolveFontStack,
} from "../fonts";

describe("font presets", () => {
  it("covers every id exactly once", () => {
    expect(FONT_PRESETS.map(preset => preset.id)).toEqual([...FONT_IDS]);
  });

  it("defaults to the preset that ships no webfont", () => {
    expect(DEFAULT_FONT_ID).toBe("system");
    expect(FONT_PRESETS.find(preset => preset.id === "system")?.family).toBeNull();
  });
});

describe("resolveFontStack", () => {
  it("returns null for the system preset so Tailwind's default stands", () => {
    expect(resolveFontStack("system")).toBeNull();
  });

  it("quotes the family and keeps the fallbacks behind it", () => {
    const stack = resolveFontStack("inter");

    expect(stack).toMatch(/^'Inter Variable', /);
    expect(stack).toContain("ui-sans-serif");
    expect(stack).toContain("system-ui");
  });

  it("names each bundled family first", () => {
    expect(resolveFontStack("manrope")).toMatch(/^'Manrope Variable', /);
    expect(resolveFontStack("onest")).toMatch(/^'Onest Variable', /);
  });

  it("degrades an unknown id to the default rather than a broken family", () => {
    expect(resolveFontStack("comic" as never)).toBeNull();
  });
});

describe("fontPreviewStack", () => {
  it("spells out the fallback stack for system, so a preview never inherits the active font", () => {
    const stack = fontPreviewStack("system");

    expect(stack).toContain("ui-sans-serif");
    expect(stack).not.toContain("Variable");
  });

  it("matches the applied stack for a bundled font", () => {
    expect(fontPreviewStack("onest")).toBe(resolveFontStack("onest"));
  });
});

describe("isFontId", () => {
  it("accepts every known id and rejects anything else", () => {
    for (const id of FONT_IDS) expect(isFontId(id)).toBe(true);

    expect(isFontId("comic")).toBe(false);
    expect(isFontId("")).toBe(false);
    expect(isFontId(null)).toBe(false);
    expect(isFontId(undefined)).toBe(false);
  });
});
