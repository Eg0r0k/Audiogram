import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/vue-query";
import { db } from "@/db";
import { TrackSource, TrackState, type ListenEventEntity } from "@/db/entities";
import { statsRepository } from "@/db/repositories/stats.repository";
import type { AlbumId, ArtistId, TrackId } from "@/types/ids";
import { invalidateStatsQueries, statsQueries } from "../stats.queries";

//
// The stats page mounts ~8 aggregate queries for the same period. They must
// share ONE read of listenEvents (the events query) instead of each pulling
// the whole table.
//

let seq = 0;
const event = (overrides: Partial<ListenEventEntity> = {}): ListenEventEntity => ({
  id: `e${++seq}`,
  trackId: "t1" as TrackId,
  artistId: "a1" as ArtistId,
  albumId: "al1" as AlbumId,
  startedAt: 1_000_000,
  secondsListened: 100,
  trackDuration: 200,
  completed: true,
  skipped: false,
  origin: "user",
  ...overrides,
});

describe("stats queries share one events read", () => {
  let queryClient: QueryClient;

  beforeEach(async () => {
    vi.restoreAllMocks();
    queryClient = new QueryClient();
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    await db.listenEvents.bulkAdd([
      event({ secondsListened: 120 }),
      event({ trackId: "t2" as TrackId, artistId: "a2" as ArtistId, secondsListened: 30, skipped: true }),
      event({ startedAt: 500 }), // before `since`
    ]);
  });

  it("aggregates for one period read listenEvents once", async () => {
    const read = vi.spyOn(statsRepository, "eventsSince");
    const since = 900;

    const [summary, total, hourly, records] = await Promise.all([
      queryClient.fetchQuery(statsQueries.summary(since)),
      queryClient.fetchQuery(statsQueries.totalTime(since)),
      queryClient.fetchQuery(statsQueries.hourlyActivity(since)),
      queryClient.fetchQuery(statsQueries.records(since)),
    ]);

    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith(since);
    expect(summary).toMatchObject({ totalSeconds: 150, playsCount: 1, skippedCount: 1 });
    expect(total).toBe(150);
    expect(hourly.reduce((a, b) => a + b, 0)).toBe(150);
    expect(records.mostRepeatedTrackId).toBe("t1");
  });

  // The events entry has no observer of its own, so an invalidation only
  // marks it stale; an aggregate that then reads it through the cache must
  // still see the new events, or the stats page freezes for a gcTime.
  it("re-reads the events once the stats were invalidated", async () => {
    const read = vi.spyOn(statsRepository, "eventsSince");
    await queryClient.fetchQuery(statsQueries.summary(900));
    await db.listenEvents.add(event({ secondsListened: 50 }));

    await invalidateStatsQueries(queryClient);
    const summary = await queryClient.fetchQuery(statsQueries.summary(900));

    expect(read).toHaveBeenCalledTimes(2);
    expect(summary.totalSeconds).toBe(200);
  });

  it("a different period is a different read", async () => {
    const read = vi.spyOn(statsRepository, "eventsSince");

    await queryClient.fetchQuery(statsQueries.summary(900));
    await queryClient.fetchQuery(statsQueries.summary(undefined));

    expect(read).toHaveBeenCalledTimes(2);
    expect((await queryClient.fetchQuery(statsQueries.summary(undefined))).totalSeconds).toBe(250);
  });
});

describe("top artists", () => {
  let queryClient: QueryClient;

  const track = (id: string, artistName: string, artistIds: string[]) => ({
    id: id as TrackId,
    title: id,
    artistName,
    albumTitle: "",
    artistIds: artistIds as ArtistId[],
    albumId: "" as AlbumId,
    tagIds: [],
    source: TrackSource.REMOTE_SUBSONIC,
    state: TrackState.READY,
    pinned: 0 as const,
    duration: 200,
    format: {},
    playCount: 0,
    addedAt: 1,
  });

  beforeEach(async () => {
    queryClient = new QueryClient();
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
  });

  it("uses the artist row when the library has one", async () => {
    await db.artists.add({ id: "a1" as ArtistId, name: "Library A", pinned: 1, addedAt: 1, updatedAt: 1 });
    await db.listenEvents.add(event());

    const top = await queryClient.fetchQuery(statsQueries.topArtists(5));

    expect(top.map(entry => entry.artist)).toMatchObject([{ id: "a1", name: "Library A" }]);
  });

  it("names an artist without a row after the listened track's credit", async () => {
    await db.tracks.add(track("nd:s1", "Artist A, Artist B", ["nd:a", "nd:b"]));
    await db.listenEvents.add(event({ trackId: "nd:s1" as TrackId, artistId: "nd:b" as ArtistId }));

    const top = await queryClient.fetchQuery(statsQueries.topArtists(5));

    expect(top.map(entry => entry.artist)).toEqual([{ id: "nd:b", name: "Artist B" }]);
  });

  it("falls back to the whole caption when the credits do not line up with the ids", async () => {
    await db.tracks.add(track("yt:v1", "A & B", ["yt:UCcollab"]));
    await db.listenEvents.add(event({ trackId: "yt:v1" as TrackId, artistId: "yt:UCcollab" as ArtistId }));

    const top = await queryClient.fetchQuery(statsQueries.topArtists(5));

    expect(top.map(entry => entry.artist)).toEqual([{ id: "yt:UCcollab", name: "A & B" }]);
  });
});
