import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

// The module holds a singleton store + watcher, so each test needs its own
// copy to start from a known localStorage value.
const loadModule = async () => {
  vi.resetModules();
  return import("../useFont");
};

describe("useFont", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("style");
  });

  it("leaves --font-sans alone for the system preset", async () => {
    const { useFont } = await loadModule();

    useFont();

    expect(document.documentElement.style.getPropertyValue("--font-sans")).toBe("");
  });

  it("re-applies the persisted font at startup", async () => {
    localStorage.setItem("app-font", "manrope");
    const { initFont } = await loadModule();

    initFont();

    expect(document.documentElement.style.getPropertyValue("--font-sans"))
      .toMatch(/^'Manrope Variable', /);
  });

  it("writes the stack when a font is picked and clears it on the way back", async () => {
    const { useFont } = await loadModule();
    const { setFont } = useFont();

    setFont("inter");
    await nextTick();

    expect(document.documentElement.style.getPropertyValue("--font-sans"))
      .toMatch(/^'Inter Variable', /);

    setFont("system");
    await nextTick();

    expect(document.documentElement.style.getPropertyValue("--font-sans")).toBe("");
  });

  it("persists the pick under app-font", async () => {
    const { useFont } = await loadModule();

    useFont().setFont("onest");
    await nextTick();

    expect(localStorage.getItem("app-font")).toBe("onest");
  });

  it("falls back to the default when storage holds an unknown id", async () => {
    localStorage.setItem("app-font", "comic");
    const { useFont } = await loadModule();

    const { font } = useFont();
    await nextTick();

    expect(font.value).toBe("system");
    expect(localStorage.getItem("app-font")).toBe("system");
    expect(document.documentElement.style.getPropertyValue("--font-sans")).toBe("");
  });
});
