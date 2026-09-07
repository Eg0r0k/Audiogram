import { afterEach, describe, expect, it, vi } from "vitest";
import { createCalendarTooltipFormatter } from "../time";

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
