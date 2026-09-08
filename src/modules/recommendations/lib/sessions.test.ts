import { describe, it, expect } from "vitest";
import type { ListenEventEntity } from "@/db/entities";
import type { TrackId, ArtistId } from "@/types/ids";
import { buildSessions } from "./sessions";

const tid = (s: string) => s as TrackId;
const aid = (s: string) => s as ArtistId;
const MIN = 60_000;

const makeEvent = (
  trackId: string,
  startedAt: number,
  o: Partial<ListenEventEntity> = {},
): ListenEventEntity => ({
  id: `${trackId}-${startedAt}`,
  trackId: tid(trackId),
  artistId: aid(`ar-${trackId}`),
  albumId: "al" as any,
  startedAt,
  secondsListened: 180,
  trackDuration: 200,
  completed: true,
  skipped: false,
  origin: "user",
  ...o,
});

describe("buildSessions", () => {
  it("splits two events with a 31 minute gap into two sessions, both dropped at minLength 2", () => {
    const events = [
      makeEvent("t1", 0),
      makeEvent("t2", 31 * MIN),
    ];
    const sessions = buildSessions(events);
    expect(sessions).toEqual([]);
  });

  it("keeps five events 4 minutes apart as one session in startedAt order, even if input is shuffled", () => {
    const events = [
      makeEvent("t1", 0),
      makeEvent("t2", 4 * MIN),
      makeEvent("t3", 8 * MIN),
      makeEvent("t4", 12 * MIN),
      makeEvent("t5", 16 * MIN),
    ];
    const shuffled = [events[3], events[0], events[4], events[1], events[2]];
    const sessions = buildSessions(shuffled);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].map(e => e.trackId)).toEqual(["t1", "t2", "t3", "t4", "t5"]);
  });

  it("collapses consecutive repeats of the same track into the first event", () => {
    const events = [
      makeEvent("t1", 0),
      makeEvent("t1", 1 * MIN),
      makeEvent("t2", 2 * MIN),
    ];
    const sessions = buildSessions(events, undefined, 1);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].map(e => e.trackId)).toEqual(["t1", "t2"]);
  });

  it("does not collapse non-adjacent repeats of the same track", () => {
    const events = [
      makeEvent("t1", 0),
      makeEvent("t2", 1 * MIN),
      makeEvent("t1", 2 * MIN),
    ];
    const sessions = buildSessions(events, undefined, 1);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].map(e => e.trackId)).toEqual(["t1", "t2", "t1"]);
  });

  it("keeps a skipped event in the session with skipped: true", () => {
    const events = [
      makeEvent("t1", 0),
      makeEvent("t2", 1 * MIN, { skipped: true, completed: false }),
    ];
    const sessions = buildSessions(events);
    expect(sessions).toHaveLength(1);
    expect(sessions[0][1]).toMatchObject({ trackId: "t2", skipped: true });
  });

  it("drops sessions shorter than minLength (default 2)", () => {
    const events = [makeEvent("t1", 0)];
    const sessions = buildSessions(events);
    expect(sessions).toEqual([]);
  });

  it("copies all SessionEvent fields from the entity", () => {
    const events = [
      makeEvent("t1", 0, { secondsListened: 42, origin: "autoplay" }),
      makeEvent("t2", 1 * MIN, { secondsListened: 99 }),
    ];
    const sessions = buildSessions(events);
    expect(sessions[0][0]).toEqual({
      trackId: tid("t1"),
      artistId: aid("ar-t1"),
      startedAt: 0,
      skipped: false,
      completed: true,
      origin: "autoplay",
      secondsListened: 42,
    });
  });
});
