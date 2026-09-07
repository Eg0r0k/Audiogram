import { describe, expect, it, vi } from "vitest";
import { TrackId } from "@/types/ids";
import type { TrackEntity } from "@/db/entities";
import type { PlayerTrack, Track } from "@/modules/player/types";
import type { QueueItem } from "../../types";
import { createAutoplayRecommender, registerAutoplaySource, type AutoplaySource } from "../queue-autoplay";

const libraryTrack = (id: string): Track => ({
  kind: "library",
  id: TrackId(id),
  title: id,
  artist: "",
  artistIds: [],
  albumId: undefined,
  albumName: "",
  storagePath: "",
  source: 0 as never,
  state: 0 as never,
  pinned: false,
  duration: 1,
  isLiked: false,
  playCount: 0,
  addedAt: 0,
} as unknown as Track);

const entity = (id: string) => ({ id: TrackId(id), title: id, artistIds: [] } as unknown as TrackEntity);

const makeDeps = (appended: PlayerTrack[][]) => {
  const queue: QueueItem[] = [{ id: "q1" as never, track: libraryTrack("t1"), source: { type: "manual" }, addedAt: 0 }];
  return {
    repeatMode: () => "off" as const,
    queue: () => queue,
    currentIndex: () => 0,
    currentItem: () => queue[0] ?? null,
    append: (tracks: PlayerTrack[]) => appended.push(tracks),
  };
};

describe("createAutoplayRecommender", () => {
  it("does nothing while no autoplay source is registered", async () => {
    registerAutoplaySource(null);
    const appended: PlayerTrack[][] = [];
    const recommender = createAutoplayRecommender(makeDeps(appended));

    await expect(recommender.ensure()).resolves.toBe(false);
    expect(appended).toEqual([]);
  });

  it("appends what the registered source returns", async () => {
    const source: AutoplaySource = vi.fn(async () => [{ track: entity("r1") }, { track: entity("r2") }]);
    registerAutoplaySource(source);
    const appended: PlayerTrack[][] = [];
    const recommender = createAutoplayRecommender(makeDeps(appended));

    await expect(recommender.ensure()).resolves.toBe(true);
    expect(source).toHaveBeenCalledWith(TrackId("t1"), 5, []);
    expect(appended[0]?.map(track => track.id)).toEqual(["r1", "r2"]);
  });
});
