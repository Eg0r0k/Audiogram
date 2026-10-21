export type StatsPeriod = "week" | "month" | "year" | "all";

export interface PeriodRange {
  /** Start of the current calendar period; absent for all time. */
  since?: number;
  /** The whole calendar period before it, which the total is compared with. */
  previous?: { from: number; to: number };
}

// Calendar periods, not rolling windows: the page names them ("October",
// "this week") and compares with the one before, which a 30-day window that
// straddles two months cannot be called.
export const periodRange = (period: StatsPeriod, now: Date = new Date()): PeriodRange => {
  if (period === "all") return {};

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const previous = new Date(start);

  if (period === "week") {
    // Monday first, whatever the locale's convention.
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    previous.setTime(start.getTime());
    previous.setDate(previous.getDate() - 7);
  }
  else if (period === "month") {
    start.setDate(1);
    previous.setTime(start.getTime());
    previous.setMonth(previous.getMonth() - 1);
  }
  else {
    start.setMonth(0, 1);
    previous.setTime(start.getTime());
    previous.setFullYear(previous.getFullYear() - 1);
  }

  return { since: start.getTime(), previous: { from: previous.getTime(), to: start.getTime() } };
};

export const periodSince = (period: StatsPeriod, now?: Date): number | undefined => periodRange(period, now).since;

export interface PeriodComparison {
  direction: "more" | "less" | "same";
  percent: number;
}

/** Null when the previous period has nothing to compare with. */
export const comparePeriods = (currentSeconds: number, previousSeconds: number): PeriodComparison | null => {
  if (previousSeconds <= 0) return null;
  const percent = Math.round(((currentSeconds - previousSeconds) / previousSeconds) * 100);
  if (percent === 0) return { direction: "same", percent: 0 };
  return { direction: percent > 0 ? "more" : "less", percent: Math.abs(percent) };
};
