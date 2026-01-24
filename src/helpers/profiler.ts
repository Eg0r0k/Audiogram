export class TimeProfiler {
  private timings: Map<string, number> = new Map();
  private starts: Map<string, number> = new Map();

  start(phase: string): void {
    this.starts.set(phase, performance.now());
  }

  end(phase: string): number {
    const start = this.starts.get(phase);
    if (start === undefined) {
      // console.warn(`TimeProfiler: phase "${phase}" ended without start`);
      return 0;
    }

    const duration = performance.now() - start;
    const currentTotal = this.timings.get(phase) ?? 0;
    this.timings.set(phase, currentTotal + duration);

    this.starts.delete(phase);

    return duration;
  }

  reset(): void {
    this.timings.clear();
    this.starts.clear();
  }

  getTimings(): Record<string, number> {
    return Object.fromEntries(this.timings);
  }

  printReport(label: string): void {
    const timings = this.getTimings();
    const total = Object.values(timings).reduce((a, b) => a + b, 0);

    if (total === 0) return;

    console.group(`📊 ${label} - Performance Report`);
    console.table(
      Object.entries(timings)
        .sort(([, a], [, b]) => b - a)
        .map(([phase, ms]) => ({
          "Phase": phase,
          "Time (ms)": Math.round(ms * 100) / 100,
          "%": Math.round((ms / total) * 1000) / 10,
        })),
    );
    console.log(`Total measured time: ${Math.round(total)}ms`);
    console.groupEnd();
  }
}
