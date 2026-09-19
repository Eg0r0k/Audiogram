import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ListenEventEntity } from "@/db/entities";
import type { AlbumId, ArtistId, TrackId } from "@/types/ids";
import { measureRecordReads } from "@/test/idb-meter";

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { db } from "@/db";
import {
  EVENT_HORIZON_MS,
  getRecommenderContext,
  markRecommenderContextDirty,
} from "../recommender-context.service";

//
// The context is rebuilt in the gap between two tracks, so what it reads is
// what the user waits for. Listen history is the one input with no ceiling —
// it grows for as long as the app is used — and affinity decays it anyway, so
// the read is bounded by the horizon past which an event cannot matter.
//

const DAY = 86_400_000;
const INSIDE = 40;
const OUTSIDE = 400;

let now = 0;

const event = (index: number, startedAt: number): ListenEventEntity => ({
  id: `e${index}`,
  trackId: `t${index % 20}` as TrackId,
  artistId: "ar1" as ArtistId,
  albumId: "al1" as AlbumId,
  startedAt,
  secondsListened: 180,
  trackDuration: 200,
  completed: true,
  skipped: false,
  origin: "user",
});

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map(table => table.clear()));
  now = Date.now();

  const inside = Array.from({ length: INSIDE }, (_, i) =>
    event(i, now - (i + 1) * DAY));
  const outside = Array.from({ length: OUTSIDE }, (_, i) =>
    event(INSIDE + i, now - EVENT_HORIZON_MS - (i + 1) * DAY));

  await db.listenEvents.bulkAdd([...outside, ...inside]);
  markRecommenderContextDirty();
});

describe("getRecommenderContext", () => {
  it("keeps only the events inside the horizon", async () => {
    const ctx = await getRecommenderContext();

    expect(ctx.events).toHaveLength(INSIDE);
    expect(ctx.events.every(e => e.startedAt >= now - EVENT_HORIZON_MS)).toBe(true);
  });

  it("does not read the history beyond the horizon", async () => {
    const { valueReads } = await measureRecordReads(() => getRecommenderContext());

    expect(valueReads).toBeLessThan(INSIDE + OUTSIDE);
  });

  it("lists the most recently played tracks newest first", async () => {
    const ctx = await getRecommenderContext();

    // 20 distinct tracks, cycled; the newest event of each decides its place.
    expect(ctx.recentlyPlayed).toHaveLength(20);
    expect(ctx.recentlyPlayed[0]).toBe("t0" as TrackId);
    expect(ctx.recentlyPlayed[1]).toBe("t1" as TrackId);
  });
});
