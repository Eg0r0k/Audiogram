import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/vue-query";
import type { PlaylistEntity } from "@/db/entities";
import type { PlaylistId, TrackId } from "@/types/ids";

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

import { db } from "@/db";
import { removeTrackFromPlaylistWithUndo } from "../playlist.queries";

const P1 = "p1" as PlaylistId;
const ids = (...values: string[]) => values as TrackId[];
const playlist = (trackIds: TrackId[]): PlaylistEntity => ({ id: P1, name: "P", trackIds, addedAt: 1, updatedAt: 1 });
const storedTrackIds = async () => (await db.playlists.get(P1))?.trackIds;

describe("removing a track from a playlist with undo (integration)", () => {
  let queryClient: QueryClient;

  beforeEach(async () => {
    queryClient = new QueryClient();
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    await db.playlists.add(playlist(ids("a", "b", "c")));
  });

  it("puts the track back where it was", async () => {
    const { restore } = await removeTrackFromPlaylistWithUndo(queryClient, P1, "b");
    expect(await storedTrackIds()).toEqual(ids("a", "c"));

    await restore();

    expect(await storedTrackIds()).toEqual(ids("a", "b", "c"));
  });

  it("keeps what changed in the playlist meanwhile", async () => {
    const { restore } = await removeTrackFromPlaylistWithUndo(queryClient, P1, "b");
    await db.playlists.update(P1, { trackIds: ids("a", "c", "d") });

    await restore();

    expect(await storedTrackIds()).toEqual(ids("a", "b", "c", "d"));
  });

  it("does not add the track twice when it came back another way", async () => {
    const { restore } = await removeTrackFromPlaylistWithUndo(queryClient, P1, "b");
    await db.playlists.update(P1, { trackIds: ids("a", "c", "b") });

    await restore();

    expect(await storedTrackIds()).toEqual(ids("a", "c", "b"));
  });
});
