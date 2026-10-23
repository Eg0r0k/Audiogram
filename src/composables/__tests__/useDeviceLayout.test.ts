import { afterEach, describe, expect, it, vi } from "vitest";

describe("useDeviceLayout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shares one media query between all callers", async () => {
    vi.resetModules();
    const matchMedia = vi.spyOn(window, "matchMedia");
    const { useDeviceLayout } = await import("../useDeviceLayout");

    const [first, ...others] = [useDeviceLayout(), useDeviceLayout(), useDeviceLayout()];

    const layoutQueries = matchMedia.mock.calls.filter(([query]) => query.includes("width"));
    expect(layoutQueries.length).toBeLessThanOrEqual(1);
    for (const layout of others) {
      expect(layout.isMobileLayout).toBe(first.isMobileLayout);
      expect(layout.isDesktopLayout).toBe(first.isDesktopLayout);
      expect(layout.layoutType).toBe(first.layoutType);
    }
    expect(first.isDesktopLayout.value).toBe(!first.isMobileLayout.value);
  });
});
