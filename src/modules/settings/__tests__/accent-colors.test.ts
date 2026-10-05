import { describe, expect, it } from "vitest";
import { ACCENT_COLOR_OPTIONS, resolveAccentValue } from "../accent-colors";

describe("resolveAccentValue", () => {
  const blue = ACCENT_COLOR_OPTIONS[0].dark["--primary"];

  it("keeps the oklch() preset where the engine supports it", () => {
    expect(resolveAccentValue(blue, true)).toBe(blue);
  });

  it("writes hex where oklch() is unsupported (WebView < 111)", () => {
    expect(resolveAccentValue(blue, false)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("passes non-oklch values through", () => {
    expect(resolveAccentValue("#8774e1", false)).toBe("#8774e1");
  });
});
