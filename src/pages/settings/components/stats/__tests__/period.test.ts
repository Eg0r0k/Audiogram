import { describe, expect, it } from "vitest";
import { comparePeriods, periodRange } from "../period";

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();
// Tuesday, 20 October 2026, mid-afternoon.
const NOW = new Date(2026, 9, 20, 15, 30);

describe("periodRange", () => {
  it("starts the month on the 1st and compares with the whole month before", () => {
    expect(periodRange("month", NOW)).toEqual({
      since: at(2026, 10, 1),
      previous: { from: at(2026, 9, 1), to: at(2026, 10, 1) },
    });
  });

  it("starts the week on Monday", () => {
    expect(periodRange("week", NOW)).toEqual({
      since: at(2026, 10, 19),
      previous: { from: at(2026, 10, 12), to: at(2026, 10, 19) },
    });
  });

  it("keeps a Sunday in the week that began the Monday before", () => {
    expect(periodRange("week", new Date(2026, 9, 25, 9)).since).toBe(at(2026, 10, 19));
  });

  it("starts the year on 1 January", () => {
    expect(periodRange("year", NOW)).toEqual({
      since: at(2026, 1, 1),
      previous: { from: at(2025, 1, 1), to: at(2026, 1, 1) },
    });
  });

  it("has no start and nothing to compare for all time", () => {
    expect(periodRange("all", NOW)).toEqual({});
  });
});

describe("comparePeriods", () => {
  it("is null without a previous period to compare with", () => {
    expect(comparePeriods(3600, 0)).toBeNull();
  });

  it("rounds the change and names its direction", () => {
    expect(comparePeriods(1170, 1000)).toEqual({ direction: "more", percent: 17 });
    expect(comparePeriods(500, 1000)).toEqual({ direction: "less", percent: 50 });
    expect(comparePeriods(1001, 1000)).toEqual({ direction: "same", percent: 0 });
  });
});
