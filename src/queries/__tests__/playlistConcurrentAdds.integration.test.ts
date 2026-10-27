import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlaylistEntity } from "@/db/entities";
import type { PlaylistId, TrackId } from "@/types/ids";
import type { Track } from "@/types/track";

//
// Two adds to one playlist can overlap (row menus await per call, nothing
// serialises them). The row must end up with both, and each call hands back
// the row as it is after its own write.
//

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

import { db } from "@/db";
import { addTrackToPlaylistAndSync, removeTrackFromPlaylistAndSync } from "../playlist.queries";

const P1 = "p1" as PlaylistId;
const asPlayerTrack = (id: string): Track => ({ id, isLiked: false } as unknown as Track);
const playlist = (trackIds: string[]): PlaylistEntity =>
  ({ id: P1, name: "P", trackIds: trackIds as TrackId[], addedAt: 1, updatedAt: 1 });

describe("overlapping playlist adds (integration)", () => {
  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
  });

  it("two adds that overlap leave both rows in the playlist", async () => {
    await db.playlists.add(playlist([]));

    const [first, second] = await Promise.all([
      addTrackToPlaylistAndSync(P1, asPlayerTrack("t1")),
      addTrackToPlaylistAndSync(P1, asPlayerTrack("t2")),
    ]);

    expect((await db.playlists.get(P1))?.trackIds).toEqual(["t1", "t2"]);
    expect([first.trackIds, second.trackIds]).toContainEqual(["t1", "t2"]);
  });

  it("two removals that overlap leave neither row in the playlist", async () => {
    await db.playlists.add(playlist(["t1", "t2", "t3"]));

    await Promise.all([
      removeTrackFromPlaylistAndSync(P1, "t1"),
      removeTrackFromPlaylistAndSync(P1, "t2"),
    ]);

    expect((await db.playlists.get(P1))?.trackIds).toEqual(["t3"]);
  });
});
