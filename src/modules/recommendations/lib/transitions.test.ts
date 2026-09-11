import { describe, it, expect } from "vitest";
import type { TrackId, ArtistId } from "@/types/ids";
import type { Session, SessionEvent } from "./sessions";
import {
  buildTransitions,
  subtractTransitions,
  transitionWeight,
  type TransitionMatrix,
} from "./transitions";

const tid = (s: string) => s as TrackId;
const aid = (s: string) => s as ArtistId;

const ev = (trackId: string, artistId: string, o: Partial<SessionEvent> = {}): SessionEvent => ({
  trackId: tid(trackId),
  artistId: aid(artistId),
  startedAt: 0,
  skipped: false,
  completed: true,
  origin: "user",
  secondsListened: 180,
  ...o,
});

const expectMatrixCloseTo = <K extends string>(
  actual: TransitionMatrix<K>,
  expected: ReadonlyArray<[K, K, number]>,
): void => {
  for (const [from, to, value] of expected) {
    expect(actual.get(from)?.get(to)).toBeCloseTo(value, 6);
  }
};

describe("buildTransitions", () => {
  it("computes forward and backward weights for a 3-event session", () => {
    const session: Session = [ev("a", "art-a"), ev("b", "art-b"), ev("c", "art-c")];
    const { tracks } = buildTransitions([session]);

    expect(tracks.get(tid("a"))?.get(tid("b"))).toBeCloseTo(1, 6);
    expect(tracks.get(tid("a"))?.get(tid("c"))).toBeCloseTo(0.5, 6);
    expect(tracks.get(tid("b"))?.get(tid("a"))).toBeCloseTo(0.5, 6);
    expect(tracks.get(tid("c"))?.get(tid("a"))).toBeCloseTo(0.25, 6);
  });

  it("flips sign for a skipped target", () => {
    const session: Session = [ev("a", "art-a"), ev("b", "art-b", { skipped: true, completed: false })];
    const { tracks } = buildTransitions([session]);

    expect(tracks.get(tid("a"))?.get(tid("b"))).toBeCloseTo(-0.5, 6);
    expect(transitionWeight(tracks, tid("a"), tid("b"))).toBeCloseTo(-0.5 / 1.5, 6);
  });

  it("scales down an autoplay target", () => {
    const session: Session = [ev("a", "art-a"), ev("b", "art-b", { origin: "autoplay" })];
    const { tracks } = buildTransitions([session]);

    expect(tracks.get(tid("a"))?.get(tid("b"))).toBeCloseTo(0.3, 6);
  });

  it("does not link tracks beyond the window", () => {
    const session: Session = Array.from({ length: 8 }, (_, i) => ev(`s${i}`, `art-s${i}`));
    const { tracks } = buildTransitions([session]);

    expect(tracks.get(tid("s0"))?.get(tid("s5"))).toBeCloseTo(1 / 5, 6);
    expect(tracks.get(tid("s0"))?.get(tid("s6"))).toBeUndefined();
  });

  it("produces no self-transition when the same track appears twice in a session", () => {
    const session: Session = [ev("a", "art-a"), ev("b", "art-b"), ev("a", "art-a")];
    const { tracks } = buildTransitions([session]);

    expect(tracks.get(tid("a"))?.get(tid("a"))).toBeUndefined();
  });

  it("aggregates artist transitions from forward and backward track pairs, skipping same-artist pairs", () => {
    const session: Session = [ev("a", "art1"), ev("b", "art2"), ev("c", "art1")];
    const { artists } = buildTransitions([session]);

    expect(artists.get(aid("art1"))?.get(aid("art2"))).toBeCloseTo(1 + 0.5, 6);
    expect(artists.get(aid("art2"))?.get(aid("art1"))).toBeCloseTo(0.5 + 1, 6);
  });
});

describe("transitionWeight", () => {
  it("returns 0 for a missing pair", () => {
    const m: TransitionMatrix<TrackId> = new Map();
    expect(transitionWeight(m, tid("a"), tid("b"))).toBe(0);
  });

  it("shrinks v = 3 to 0.75", () => {
    const m: TransitionMatrix<TrackId> = new Map([[tid("a"), new Map([[tid("b"), 3]])]]);
    expect(transitionWeight(m, tid("a"), tid("b"))).toBeCloseTo(0.75, 6);
  });
});

describe("subtractTransitions", () => {
  it("removes s2's contribution, leaving s1's transitions, without mutating base", () => {
    const s1: Session = [ev("a", "art1"), ev("b", "art2"), ev("c", "art1")];
    const s2: Session = [ev("b", "art2"), ev("c", "art1"), ev("d", "art3")];

    const base = buildTransitions([s1, s2]);
    const minus = buildTransitions([s2]);
    const expected = buildTransitions([s1]);

    const baseTracksSnapshot = new Map([...base.tracks].map(([k, v]) => [k, new Map(v)]));
    const baseArtistsSnapshot = new Map([...base.artists].map(([k, v]) => [k, new Map(v)]));

    const result = subtractTransitions(base, minus);

    for (const [from, row] of expected.tracks) {
      for (const [to, value] of row) {
        expect(result.tracks.get(from)?.get(to)).toBeCloseTo(value, 6);
      }
    }
    for (const [from, row] of result.tracks) {
      for (const [to, value] of row) {
        expect(expected.tracks.get(from)?.get(to)).toBeCloseTo(value, 6);
      }
    }
    for (const [from, row] of expected.artists) {
      for (const [to, value] of row) {
        expect(result.artists.get(from)?.get(to)).toBeCloseTo(value, 6);
      }
    }
    for (const [from, row] of result.artists) {
      for (const [to, value] of row) {
        expect(expected.artists.get(from)?.get(to)).toBeCloseTo(value, 6);
      }
    }

    for (const [from, row] of baseTracksSnapshot) {
      for (const [to, value] of row) {
        expect(base.tracks.get(from)?.get(to)).toBeCloseTo(value, 6);
      }
    }
    for (const [from, row] of baseArtistsSnapshot) {
      for (const [to, value] of row) {
        expect(base.artists.get(from)?.get(to)).toBeCloseTo(value, 6);
      }
    }
  });

  it("deletes entries that cancel out to (near) zero, and empty rows entirely", () => {
    const session: Session = [ev("a", "art1"), ev("b", "art2")];
    const base = buildTransitions([session]);
    const minus = buildTransitions([session]);

    const result = subtractTransitions(base, minus);

    expect(result.tracks.get(tid("a"))).toBeUndefined();
    expect(result.tracks.get(tid("b"))).toBeUndefined();
  });
});
