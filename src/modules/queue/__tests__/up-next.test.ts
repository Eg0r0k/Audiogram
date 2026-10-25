import { describe, expect, it } from "vitest";
import { TrackSource, TrackState } from "@/db/entities";
import type { Track } from "@/types/track";
import { QueueItemId } from "@/types/ids";
import type { QueueItem } from "../types";
import { resolveUpNext, type UpNext } from "../lib/up-next";

const item = (i: number): QueueItem => {
  const track: Track = {
    kind: "library",
    id: `track-${i}` as Track["id"],
    title: `Track ${i}`,
    artist: "Artist",
    artistIds: [],
    albumId: "album-1" as Track["albumId"],
    albumName: "Album",
    storagePath: `tracks/${i}.mp3`,
    source: TrackSource.LOCAL_INTERNAL,
    state: TrackState.READY,
    duration: 120,
    isLiked: false,
  };
  return { id: QueueItemId(`item-${i}`), track, source: { type: "manual" }, addedAt: i };
};

const queueOf = (length: number) => Array.from({ length }, (_, i) => item(i));

const indexes = (upNext: UpNext) => (upNext.kind === "tracks" ? upNext.entries.map(entry => entry.index) : []);

describe("resolveUpNext", () => {
  it("lists up to three entries after the current one", () => {
    const queue = queueOf(6);

    const upNext = resolveUpNext(queue, 1, "off", false);

    expect(upNext.kind).toBe("tracks");
    expect(indexes(upNext)).toEqual([2, 3, 4]);
    if (upNext.kind === "tracks") {
      expect(upNext.entries.map(entry => entry.item)).toEqual([queue[2], queue[3], queue[4]]);
    }
    expect(indexes(resolveUpNext(queue, 4, "off", false))).toEqual([5]);
  });

  it("wraps to the head of the queue on repeat all at the last entry", () => {
    const upNext = resolveUpNext(queueOf(5), 4, "all", false);

    expect(upNext.kind).toBe("tracks");
    expect(indexes(upNext)).toEqual([0, 1, 2]);
  });

  it("fills the remainder from the head on repeat all near the end", () => {
    expect(indexes(resolveUpNext(queueOf(5), 3, "all", false))).toEqual([4, 0, 1]);
    expect(indexes(resolveUpNext(queueOf(3), 2, "all", false))).toEqual([0, 1]);
  });

  it("shows the current entry alone on repeat one", () => {
    const queue = queueOf(5);

    expect(resolveUpNext(queue, 2, "one", true)).toEqual({ kind: "repeat-one", entry: { item: queue[2], index: 2 } });
  });

  it("treats a one-entry queue on repeat all as repeating the current entry", () => {
    const queue = queueOf(1);

    expect(resolveUpNext(queue, 0, "all", false)).toEqual({ kind: "repeat-one", entry: { item: queue[0], index: 0 } });
  });

  it("ends in autoplay at the tail when something continues", () => {
    expect(resolveUpNext(queueOf(4), 3, "off", true)).toEqual({ kind: "autoplay" });
  });

  it("ends in end at the tail when nothing continues", () => {
    expect(resolveUpNext(queueOf(4), 3, "off", false)).toEqual({ kind: "end" });
  });

  it("returns none when nothing is current", () => {
    expect(resolveUpNext(queueOf(4), -1, "off", true)).toEqual({ kind: "none" });
    expect(resolveUpNext([], -1, "all", false)).toEqual({ kind: "none" });
    expect(resolveUpNext(queueOf(2), 5, "one", false)).toEqual({ kind: "none" });
  });
});
