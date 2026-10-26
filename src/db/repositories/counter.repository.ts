import { db } from "@/db";
import {
  addCounterDeltas,
  counterDeltas,
  isNoDelta,
  NO_COUNTER_DELTAS,
  toCounters,
  type CounterDelta,
  type Counters,
  type Tally,
} from "@/db/counters";
import type { CounterEntity, CounterId } from "@/db/entities";
import { tableOf, withinTransaction, type TableSource } from "@/db/tables";
import { unique } from "@/lib/math";
import type { TrackId } from "@/types/ids";
import { guarded } from "./base.repository";

const zero = (id: CounterId): CounterEntity => ({ id, count: 0, seconds: 0 });

export class CounterRepository {
  private readonly counters;
  private readonly tracks;

  constructor(private readonly source: TableSource = db) {
    this.counters = tableOf(source, "counters");
    this.tracks = tableOf(source, "tracks");
  }

  get(id: CounterId): Promise<CounterEntity> {
    return guarded(async () => (await this.counters.get(id)) ?? zero(id));
  }

  getAll(): Promise<Counters> {
    return guarded(async () => {
      const [liked, members] = await this.counters.bulkGet(["liked", "members"]);
      return { liked: liked ?? zero("liked"), members: members ?? zero("members") };
    });
  }

  adjust(id: CounterId, delta: CounterDelta): Promise<void> {
    if (isNoDelta(delta)) return Promise.resolve();
    return guarded(() => withinTransaction(this.source, ["counters"], async () => {
      const current = (await this.counters.get(id)) ?? zero(id);
      const count = current.count + delta.count;
      // Durations are fractional: an emptied set reads exactly zero, not a float residue.
      await this.counters.put({ id, count, seconds: count === 0 ? 0 : current.seconds + delta.seconds });
    }));
  }

  rebuild(): Promise<Counters> {
    return guarded(() => withinTransaction(this.source, ["tracks", "counters"], async () => {
      const liked = { count: 0, seconds: 0 };
      await this.tracks.where("likedAt").above(0).each((row) => {
        const share = counterDeltas(undefined, row).liked;
        liked.count += share.count;
        liked.seconds += share.seconds;
      });
      const members = await this.tracks.where("pinned").equals(1).count();
      const counters = toCounters({ liked, members: { count: members, seconds: 0 } });
      await this.counters.bulkPut(Object.values(counters));
      return counters;
    }));
  }

  // One transaction over both tables; `write` reports every row it touched as (before, after).
  counting<T>(write: (tally: Tally) => Promise<T>): Promise<T> {
    return guarded(() => withinTransaction(this.source, ["tracks", "counters"], async () => {
      let totals = NO_COUNTER_DELTAS;
      const result = await write((before, after) => {
        totals = addCounterDeltas(totals, counterDeltas(before, after));
      });
      await this.adjust("liked", totals.liked);
      await this.adjust("members", totals.members);
      return result;
    }));
  }

  // For a write only Dexie can apply (an update spec): its rows are read before and after it.
  countingByIds<T>(ids: () => readonly TrackId[] | Promise<readonly TrackId[]>, write: () => Promise<T>): Promise<T> {
    return this.counting(async (tally) => {
      const keys = unique(await ids());
      const before = await this.tracks.bulkGet(keys);
      const result = await write();
      const after = await this.tracks.bulkGet(keys);
      before.forEach((row, index) => tally(row, after[index]));
      return result;
    });
  }
}

export const counterRepository = new CounterRepository();
