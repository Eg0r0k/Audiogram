import { afterEach, describe, expect, it, vi } from "vitest";
import { createCalendarTooltipFormatter, formatRelativeTime } from "../time";

const t = (key: string, params?: Record<string, unknown>) => `${key}:${String(params?.count)}`;

describe("createCalendarTooltipFormatter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formats a local day key with the listened minutes", () => {
    const format = createCalendarTooltipFormatter("en", t);

    expect(format("2026-03-05", 150)).toBe("Mar 5: common.minutesShort:3");
  });

  it("builds the Intl formatter once for the whole calendar", () => {
    const Original = Intl.DateTimeFormat;
    const spy = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      function (...args: ConstructorParameters<typeof Intl.DateTimeFormat>) {
        return new Original(...args);
      } as unknown as typeof Intl.DateTimeFormat,
    );
    const format = createCalendarTooltipFormatter("en", t);

    for (let day = 1; day <= 28; day++) {
      format(`2026-02-${String(day).padStart(2, "0")}`, 60);
    }

    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("formatRelativeTime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds one formatter per locale", () => {
    const Original = Intl.RelativeTimeFormat;
    const spy = vi.spyOn(Intl, "RelativeTimeFormat").mockImplementation(
      function (...args: ConstructorParameters<typeof Intl.RelativeTimeFormat>) {
        return new Original(...args);
      } as unknown as typeof Intl.RelativeTimeFormat,
    );
    const now = Date.now();
    const day = 86_400_000;

    for (let days = 1; days <= 10; days++) {
      formatRelativeTime(now - days * day, "de");
      formatRelativeTime(now - days * 60_000, "fr");
    }

    expect(spy.mock.calls.map(([locale]) => locale)).toEqual(["de", "fr"]);
    expect(formatRelativeTime(now - 3 * day, "de")).toBe(new Original("de", { numeric: "auto" }).format(-3, "day"));
    expect(formatRelativeTime(now - 3 * 60_000, "fr")).toBe(new Original("fr", { numeric: "auto" }).format(-3, "minute"));
  });
});
