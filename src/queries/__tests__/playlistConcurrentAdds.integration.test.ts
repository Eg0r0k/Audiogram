import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/vue-query";
import type { PlaylistEntity } from "@/db/entities";
import type { PlaylistId, TrackId } from "@/types/ids";
import type { Track } from "@/modules/player/types";
import type { LibrarySummaryData } from "../types";

//
// Two adds to one playlist can overlap (row menus await per call, nothing
// serialises them). Dexie appends both; the caches must end up with both
// too, not with whichever add read the row last before its write.
//

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

import { db } from "@/db";
import { addTrackToPlaylistAndSync, removeTrackFromPlaylistAndSync } from "../playlist.queries";
import { queryKeys } from "../query-keys";

const P1 = "p1" as PlaylistId;
const asPlayerTrack = (id: string): Track => ({ id, isLiked: false } as unknown as Track);
const playlist = (trackIds: string[]): PlaylistEntity =>
  ({ id: P1, name: "P", trackIds: trackIds as TrackId[], addedAt: 1, updatedAt: 1 });

describe("overlapping playlist adds (integration)", () => {
  let queryClient: QueryClient;

  beforeEach(async () => {
    queryClient = new QueryClient();
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
  });

  const seedCaches = (row: PlaylistEntity) => {
    queryClient.setQueryData<PlaylistEntity[]>(queryKeys.playlists.all(), [row]);
    queryClient.setQueryData<LibrarySummaryData>(queryKeys.library.summary(), {
      artists: [],
      albums: [],
      playlists: [row],
      likedCount: 0,
    } as unknown as LibrarySummaryData);
  };

  const cachedTrackIds = () => ({
    all: queryClient.getQueryData<PlaylistEntity[]>(queryKeys.playlists.all())?.[0].trackIds,
    summary: queryClient.getQueryData<LibrarySummaryData>(queryKeys.library.summary())?.playlists[0].trackIds,
    detail: queryClient.getQueryData<PlaylistEntity>(queryKeys.playlists.detail(P1))?.trackIds,
  });

  it("two adds that overlap leave both rows in every cached copy of the playlist", async () => {
    const row = playlist([]);
    await db.playlists.add(row);
    seedCaches(row);

    await Promise.all([
      addTrackToPlaylistAndSync(queryClient, P1, asPlayerTrack("t1")),
      addTrackToPlaylistAndSync(queryClient, P1, asPlayerTrack("t2")),
    ]);

    expect((await db.playlists.get(P1))?.trackIds).toEqual(["t1", "t2"]);
    const cached = cachedTrackIds();
    expect(cached.all).toEqual(["t1", "t2"]);
    expect(cached.summary).toEqual(["t1", "t2"]);
    expect(cached.detail).toEqual(["t1", "t2"]);
  });

  it("two removals that overlap leave neither row in any cached copy of the playlist", async () => {
    const row = playlist(["t1", "t2", "t3"]);
    await db.playlists.add(row);
    seedCaches(row);

    await Promise.all([
      removeTrackFromPlaylistAndSync(queryClient, P1, "t1"),
      removeTrackFromPlaylistAndSync(queryClient, P1, "t2"),
    ]);

    const cached = cachedTrackIds();
    expect(cached.all).toEqual(["t3"]);
    expect(cached.summary).toEqual(["t3"]);
    expect(cached.detail).toEqual(["t3"]);
  });
});
