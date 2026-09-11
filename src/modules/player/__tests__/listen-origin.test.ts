import { describe, expect, it } from "vitest";
import { resolveListenOrigin, resolveListenPick } from "../lib/listen-origin";
import type { QueueItem } from "@/modules/queue/types";
import type { TrackId } from "@/types/ids";

const item = (trackId: string, sourceType: QueueItem["source"]["type"]): QueueItem => ({
  id: "q1" as QueueItem["id"],
  track: { kind: "library", id: trackId as TrackId } as QueueItem["track"],
  source: { type: sourceType } as QueueItem["source"],
  addedAt: 0,
});

describe("resolveListenOrigin", () => {
  it("is autoplay when the current queue item is this track and came from autoplay", () => {
    expect(resolveListenOrigin(item("t1", "autoplay"), "t1" as TrackId)).toBe("autoplay");
  });
  it("is user for any other queue source", () => {
    expect(resolveListenOrigin(item("t1", "album"), "t1" as TrackId)).toBe("user");
    expect(resolveListenOrigin(item("t1", "recommendation"), "t1" as TrackId)).toBe("user");
  });
  it("is user when the queue item does not match the track (stale item)", () => {
    expect(resolveListenOrigin(item("t2", "autoplay"), "t1" as TrackId)).toBe("user");
  });
  it("is user without a queue item", () => {
    expect(resolveListenOrigin(null, "t1" as TrackId)).toBe("user");
  });
});

describe("resolveListenPick", () => {
  it("returns the autoplay item's pick tag for this track", () => {
    const explore: QueueItem = { ...item("t1", "autoplay"), source: { type: "autoplay", pick: "explore" } };
    expect(resolveListenPick(explore, "t1" as TrackId)).toBe("explore");
  });
  it("is undefined for an untagged autoplay item, a non-autoplay item, a mismatch or no item", () => {
    expect(resolveListenPick(item("t1", "autoplay"), "t1" as TrackId)).toBeUndefined();
    expect(resolveListenPick(item("t1", "album"), "t1" as TrackId)).toBeUndefined();
    const explore: QueueItem = { ...item("t2", "autoplay"), source: { type: "autoplay", pick: "explore" } };
    expect(resolveListenPick(explore, "t1" as TrackId)).toBeUndefined();
    expect(resolveListenPick(null, "t1" as TrackId)).toBeUndefined();
  });
});
