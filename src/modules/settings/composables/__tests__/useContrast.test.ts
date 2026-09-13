import { describe, expect, it } from "vitest";
import { resolveContrast } from "../useContrast";

describe("resolveContrast", () => {
  it("on and off ignore the system preference", () => {
    expect(resolveContrast("on", "no-preference")).toBe(true);
    expect(resolveContrast("off", "more")).toBe(false);
  });

  it("system follows prefers-contrast: more only", () => {
    expect(resolveContrast("system", "more")).toBe(true);
    expect(resolveContrast("system", "less")).toBe(false);
    expect(resolveContrast("system", "custom")).toBe(false);
    expect(resolveContrast("system", "no-preference")).toBe(false);
  });
});
