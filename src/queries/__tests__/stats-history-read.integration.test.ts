import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/vue-query";
import type { ListenEventEntity } from "@/db/entities";
import type { AlbumId, ArtistId, TrackId } from "@/types/ids";
import { measureRecordReads } from "@/test/idb-meter";

import { db } from "@/db";
import { queryKeys } from "../query-keys";
import { statsQueries } from "../stats.queries";

//
// Listen history is the one table with no ceiling. The stats page asks two
// very different questions of it — "is there anything at all" and "aggregate
// this period" — and only the second one is worth reading rows for.
//

const COUNT = 200;

const event = (index: number): ListenEventEntity => ({
  id: `e${index}`,
  trackId: `t${index % 10}` as TrackId,
  artistId: "ar1" as ArtistId,
  albumId: "al1" as AlbumId,
  startedAt: Date.now() - index * 60_000,
  secondsListened: 180,
  trackDuration: 200,
  completed: true,
  skipped: false,
  origin: "user",
});

let client: QueryClient;

beforeEach(async () => {
  await db.open();
  await db.listenEvents.clear();
  await db.listenEvents.bulkAdd(Array.from({ length: COUNT }, (_, i) => event(i)));
  client = new QueryClient();
});

describe("hasHistory", () => {
  it("answers without reading a single event row", async () => {
    const { result, valueReads } = await measureRecordReads(() =>
      client.fetchQuery(statsQueries.hasHistory()),
    );

    expect(result).toBe(true);
    expect(valueReads).toBe(0);
  });

  it("is false on an empty history", async () => {
    await db.listenEvents.clear();

    expect(await client.fetchQuery(statsQueries.hasHistory())).toBe(false);
  });

  it("does not pull the shared event list into the cache", async () => {
    await client.fetchQuery(statsQueries.hasHistory());

    expect(client.getQueryData(queryKeys.stats.events(undefined))).toBeUndefined();
  });
});

describe("the shared event list", () => {
  // Structural sharing exists to keep references stable for consumers that
  // compare by identity. Nothing does that here — the aggregates reduce the
  // array and keep only numbers — so paying a deep walk of the whole history
  // on every refetch buys nothing. Identity is deliberately not preserved.
  // `fetchQuery` hands back the raw queryFn result either way; what structural
  // sharing touches is the value left in the cache, so that is what is checked.
  it("is not deep-compared against the previous read on a refetch", async () => {
    const key = queryKeys.stats.events(undefined);

    await client.fetchQuery(statsQueries.events(undefined));
    const first = client.getQueryData<ListenEventEntity[]>(key);
    await client.invalidateQueries({ queryKey: key });
    await client.fetchQuery(statsQueries.events(undefined));
    const second = client.getQueryData<ListenEventEntity[]>(key);

    expect(second).toHaveLength(COUNT);
    expect(second).not.toBe(first);
  });
});
