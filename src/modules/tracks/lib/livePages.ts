import type { Subscription } from "dexie";
import type { TrackEntity } from "@/db/entities";
import { liveRead } from "@/db/liveRead";
import type { TrackIndexKey, TrackScope } from "@/db/repositories/track.scope";
import type { TrackSortKey } from "@/types/track-sort";

export interface LivePage<T> {
  from: TrackIndexKey | null;
  to: TrackIndexKey | null;
  rows: T[];
}

export interface LivePagesOptions<T> {
  scope: () => TrackScope;
  sort: () => TrackSortKey | undefined;
  map: (rows: TrackEntity[]) => Promise<T[]>;
  pageSize: number;
  onChange: () => void;
}

interface OpenPageResult<T> {
  rows: T[];
  first: TrackIndexKey | null;
  last: TrackIndexKey | null;
}

interface Slot<T> {
  page: LivePage<T>;
  after: TrackIndexKey | null;
  last: TrackIndexKey | null;
  subscription?: Subscription;
}

interface PendingPage<T> {
  slot: Slot<T>;
  previous: Slot<T>;
  done: () => void;
}

const sameKey = (a: TrackIndexKey, b: TrackIndexKey | null) =>
  b !== null && a.length === b.length && a.every((part, index) => part === b[index]);

const emptySlot = <T>(after: TrackIndexKey | null): Slot<T> => ({
  page: { from: null, to: null, rows: [] },
  after,
  last: null,
});

// Dexie may run a querier again after it threw, or never; the subscription ends here instead.
const follow = <R>(querier: () => Promise<R>, next: (value: R) => void, fail: (cause: unknown) => void): Subscription => {
  const subscription = liveRead(querier).subscribe({
    next,
    error: (cause: unknown) => {
      subscription.unsubscribe();
      fail(cause);
    },
  });
  return subscription;
};

// A row written between a window's upper bound and the open page's resume key lands in both.
export const uniqueById = <T extends { id: unknown }>(rows: T[]): T[] => {
  const seen = new Set<T["id"]>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
};

export class LivePages<T> {
  private slots: Slot<T>[] = [];
  private pending: PendingPage<T> | null = null;
  private sortKey: TrackSortKey | undefined;
  private exhaustedAfter: TrackIndexKey | null = null;
  private loaded = false;
  private failure: unknown;
  private loadMoreFailure: unknown;

  constructor(private readonly options: LivePagesOptions<T>) {}

  get pages(): LivePage<T>[] {
    return this.loaded ? this.slots.map(slot => slot.page) : [];
  }

  get hasMore(): boolean {
    const last = this.openSlot()?.last ?? null;
    return this.loaded && last !== null && !sameKey(last, this.exhaustedAfter);
  }

  get isLoadingMore(): boolean {
    return this.pending !== null;
  }

  get isLoaded(): boolean {
    return this.loaded;
  }

  get error(): unknown {
    return this.failure;
  }

  get loadMoreError(): unknown {
    return this.loadMoreFailure;
  }

  start(): void {
    this.clear();
    this.sortKey = this.options.sort();
    const slot = emptySlot<T>(null);
    this.slots = [slot];
    this.openPage(slot);
    this.options.onChange();
  }

  async loadMore(): Promise<void> {
    const previous = this.openSlot();
    if (!previous || this.pending || !this.hasMore) return;
    const slot = emptySlot<T>(previous.last);
    this.loadMoreFailure = undefined;
    await new Promise<void>((resolve) => {
      this.pending = { slot, previous, done: resolve };
      this.openPage(slot);
      this.options.onChange();
    });
  }

  reset(): void {
    this.clear();
    this.options.onChange();
  }

  dispose(): void {
    this.clear();
  }

  private openSlot(): Slot<T> | undefined {
    return this.slots.length > 0 ? this.slots[this.slots.length - 1] : undefined;
  }

  private openPage(slot: Slot<T>): void {
    const { scope, map, pageSize } = this.options;
    const sort = this.sortKey;
    const { after } = slot;
    slot.subscription = follow(
      async (): Promise<OpenPageResult<T>> => {
        const page = await scope().page({ sort, after, limit: pageSize });
        return { rows: await map(page.rows), first: page.first, last: page.last };
      },
      result => this.receiveOpenPage(slot, result),
      cause => this.fail(slot, cause),
    );
  }

  private openWindow(slot: Slot<T>): void {
    const { scope, map } = this.options;
    const sort = this.sortKey;
    const { from, to } = slot.page;
    slot.subscription = follow(
      async () => {
        const rows = await scope().window({ sort, from, to });
        return map(rows);
      },
      (rows) => {
        slot.page = { ...slot.page, rows };
        this.options.onChange();
      },
      cause => this.fail(slot, cause),
    );
  }

  private receiveOpenPage(slot: Slot<T>, result: OpenPageResult<T>): void {
    const { pending } = this;
    if (pending?.slot === slot) {
      this.settle(pending, result);
      return;
    }
    slot.page = { ...slot.page, rows: result.rows };
    slot.last = result.last;
    this.loaded = true;
    this.options.onChange();
  }

  private settle({ slot, previous, done }: PendingPage<T>, result: OpenPageResult<T>): void {
    this.pending = null;
    if (result.first === null) {
      slot.subscription?.unsubscribe();
      this.exhaustedAfter = slot.after;
    }
    else {
      previous.subscription?.unsubscribe();
      previous.page = { ...previous.page, to: result.first };
      this.openWindow(previous);
      slot.page = { from: result.first, to: null, rows: result.rows };
      slot.last = result.last;
      this.slots = [...this.slots, slot];
    }
    this.options.onChange();
    done();
  }

  private fail(slot: Slot<T>, cause: unknown): void {
    const { pending } = this;
    if (pending?.slot === slot) {
      this.pending = null;
      this.loadMoreFailure = cause;
      this.options.onChange();
      pending.done();
      return;
    }
    this.failure = cause;
    this.options.onChange();
  }

  private clear(): void {
    for (const slot of this.slots) slot.subscription?.unsubscribe();
    const { pending } = this;
    this.pending = null;
    pending?.slot.subscription?.unsubscribe();
    pending?.done();
    this.slots = [];
    this.exhaustedAfter = null;
    this.loaded = false;
    this.failure = undefined;
    this.loadMoreFailure = undefined;
  }
}
