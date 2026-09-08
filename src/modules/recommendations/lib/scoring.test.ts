import { describe, it, expect } from "vitest";
import type { AudioFeaturesEntity, ListenEventEntity, TrackEntity } from "@/db/entities";
import type { ArtistId, TrackId } from "@/types/ids";
import { buildAffinityMap, DEFAULT_AFFINITY_OPTIONS } from "./affinity";
import { computeFeatureStats, createAudioSpace } from "./audio-similarity";
import { buildSessions } from "./sessions";
import { buildTransitions } from "./transitions";
import {
  computeBreakdowns,
  scoreBreakdown,
  scoreCandidates,
  ranksToVector,
  DEFAULT_WEIGHTS,
  DEFAULT_RECENCY_TIERS,
  COMPONENT_KEYS,
  type ScoringContext,
  type CandidateInput,
  type ComponentRanks,
} from "./scoring";

const tid = (s: string) => s as TrackId;
const aid = (s: string) => s as ArtistId;
const GAP_MS = 30 * 60_000;

const makeTrack = (overrides: Partial<TrackEntity> = {}): TrackEntity => ({
  id: tid("track-default"),
  title: "Track",
  artistName: "Artist",
  albumTitle: "Album",
  artistIds: [aid("artist-default")],
  albumId: "album-default" as any,
  tagIds: [],
  source: "local_internal" as any,
  pinned: 1,
  state: 0,
  duration: 200,
  format: {},
  playCount: 0,
  addedAt: 0,
  ...overrides,
});

const makeFeatures = (overrides: Partial<AudioFeaturesEntity> = {}): AudioFeaturesEntity => ({
  trackId: tid("track-default"),
  bpm: 100,
  energy: 0.5,
  spectralCentroid: 2000,
  danceability: 0.6,
  key: 0,
  mode: 1,
  analyzedAt: 0,
  algorithmVersion: 1,
  ...overrides,
});

const makeEvent = (
  trackId: string,
  artistId: string,
  startedAt: number,
  overrides: Partial<ListenEventEntity> = {},
): ListenEventEntity => ({
  id: `${trackId}-${startedAt}`,
  trackId: tid(trackId),
  artistId: aid(artistId),
  albumId: "album-default" as any,
  startedAt,
  secondsListened: 180,
  trackDuration: 200,
  completed: true,
  skipped: false,
  origin: "user",
  ...overrides,
});

const buildCtx = (
  events: ListenEventEntity[],
  likedIds: ReadonlySet<TrackId>,
  featuresList: AudioFeaturesEntity[],
  now: number,
): ScoringContext => {
  const sessions = buildSessions(events, GAP_MS);
  const transitions = buildTransitions(sessions);
  const affinity = buildAffinityMap(events, likedIds, { now, ...DEFAULT_AFFINITY_OPTIONS });
  const stats = computeFeatureStats(featuresList);
  const audioSpace = stats ? createAudioSpace(stats) : null;
  return { now, audioSpace, transitions, affinity };
};

describe("computeBreakdowns / scoreCandidates", () => {
  const now = Date.now();

  it("orders candidates differently depending on the seed's audio features (empty history)", () => {
    const seedA = makeTrack({ id: tid("seedA") });
    const seedB = makeTrack({ id: tid("seedB") });
    const c1 = makeTrack({ id: tid("c1") });
    const c2 = makeTrack({ id: tid("c2") });
    const c3 = makeTrack({ id: tid("c3") });

    // bpms kept within one octave of each other so tempo-fold doesn't reorder distances.
    const fSeedA = makeFeatures({ trackId: seedA.id, bpm: 100 });
    const fSeedB = makeFeatures({ trackId: seedB.id, bpm: 126 });
    const f1 = makeFeatures({ trackId: c1.id, bpm: 100 });
    const f2 = makeFeatures({ trackId: c2.id, bpm: 112 });
    const f3 = makeFeatures({ trackId: c3.id, bpm: 126 });

    const ctx = buildCtx([], new Set(), [fSeedA, fSeedB, f1, f2, f3], now);
    const candidates: CandidateInput[] = [
      { track: c1, features: f1 },
      { track: c2, features: f2 },
      { track: c3, features: f3 },
    ];

    const orderFor = (seedTrack: TrackEntity, seedFeatures: AudioFeaturesEntity) =>
      scoreCandidates(ctx, { track: seedTrack, features: seedFeatures }, candidates)
        .slice()
        .sort((a, b) => b.score - a.score)
        .map(s => s.track.id);

    expect(orderFor(seedA, fSeedA)).toEqual([c1.id, c2.id, c3.id]);
    expect(orderFor(seedB, fSeedB)).toEqual([c3.id, c2.id, c1.id]);
  });

  it("ranks a candidate skipped early three times below one never played, at equal features", () => {
    const seed = makeTrack({ id: tid("seed") });
    const skipped = makeTrack({ id: tid("skipped") });
    const neverPlayed = makeTrack({ id: tid("never") });
    const sharedFeatures = { bpm: 110, energy: 0.4, spectralCentroid: 1800, danceability: 0.5, key: 2, mode: 0 };
    const fSkipped = makeFeatures({ trackId: skipped.id, ...sharedFeatures });
    const fNever = makeFeatures({ trackId: neverPlayed.id, ...sharedFeatures });
    const fSeed = makeFeatures({ trackId: seed.id, bpm: 90 });

    const events = [
      makeEvent("skipped", "art-skipped", now, { completed: false, skipped: true, secondsListened: 10 }),
      makeEvent("skipped", "art-skipped", now - 1000, { completed: false, skipped: true, secondsListened: 10 }),
      makeEvent("skipped", "art-skipped", now - 2000, { completed: false, skipped: true, secondsListened: 10 }),
    ];
    const ctx = buildCtx(events, new Set(), [fSeed, fSkipped, fNever], now);

    const candidates: CandidateInput[] = [
      { track: skipped, features: fSkipped },
      { track: neverPlayed, features: fNever },
    ];
    const [bSkipped, bNever] = computeBreakdowns(ctx, { track: seed, features: fSeed }, candidates);

    expect(bSkipped.affinity).toBeCloseTo(-3 / 5, 5);
    expect(bSkipped.explore).toBe(0);
    expect(bNever.affinity).toBe(0);
    expect(bNever.explore).toBe(1);
    expect(bNever.ranks.affinity).toBeGreaterThan(bSkipped.ranks.affinity);

    const scored = scoreCandidates(ctx, { track: seed, features: fSeed }, candidates)
      .slice()
      .sort((a, b) => b.score - a.score);
    expect(scored.map(s => s.track.id)).toEqual([neverPlayed.id, skipped.id]);
  });

  it("ranks a candidate that twice followed the seed in sessions above an equal-feature candidate", () => {
    const seed = makeTrack({ id: tid("seed") });
    const trans = makeTrack({ id: tid("c-trans"), artistIds: [aid("art-trans")] });
    const equal = makeTrack({ id: tid("c-equal"), artistIds: [aid("art-equal")] });
    const sharedFeatures = { bpm: 100, energy: 0.5, spectralCentroid: 2000, danceability: 0.6, key: 0, mode: 1 };
    const fTrans = makeFeatures({ trackId: trans.id, ...sharedFeatures });
    const fEqual = makeFeatures({ trackId: equal.id, ...sharedFeatures });
    const fSeed = makeFeatures({ trackId: seed.id, bpm: 90 });

    const events = [
      makeEvent("seed", "art-seed", now - 2 * 86_400_000),
      makeEvent("c-trans", "art-trans", now - 2 * 86_400_000 + 60_000),
      makeEvent("seed", "art-seed", now - 86_400_000),
      makeEvent("c-trans", "art-trans", now - 86_400_000 + 60_000),
    ];
    const ctx = buildCtx(events, new Set(), [fSeed, fTrans, fEqual], now);

    const candidates: CandidateInput[] = [
      { track: trans, features: fTrans },
      { track: equal, features: fEqual },
    ];
    const [bTrans, bEqual] = computeBreakdowns(ctx, { track: seed, features: fSeed }, candidates);

    expect(bTrans.trackTransition).toBeCloseTo(2 / 3, 6);
    expect(bEqual.trackTransition).toBe(0);

    const scored = scoreCandidates(ctx, { track: seed, features: fSeed }, candidates)
      .slice()
      .sort((a, b) => b.score - a.score);
    expect(scored.map(s => s.track.id)).toEqual([trans.id, equal.id]);
  });

  it("gives a smaller raw trackTransition boost when the same repeated transition is autoplay-origin", () => {
    const seed = makeTrack({ id: tid("seed") });
    const cand = makeTrack({ id: tid("cand") });
    const fSeed = makeFeatures({ trackId: seed.id });
    const fCand = makeFeatures({ trackId: cand.id, bpm: 130 });

    const userEvents = [
      makeEvent("seed", "art-seed", now - 2 * 86_400_000),
      makeEvent("cand", "art-cand", now - 2 * 86_400_000 + 60_000, { origin: "user" }),
      makeEvent("seed", "art-seed", now - 86_400_000),
      makeEvent("cand", "art-cand", now - 86_400_000 + 60_000, { origin: "user" }),
    ];
    const autoplayEvents = [
      makeEvent("seed", "art-seed", now - 2 * 86_400_000),
      makeEvent("cand", "art-cand", now - 2 * 86_400_000 + 60_000, { origin: "autoplay" }),
      makeEvent("seed", "art-seed", now - 86_400_000),
      makeEvent("cand", "art-cand", now - 86_400_000 + 60_000, { origin: "autoplay" }),
    ];

    const userCtx = buildCtx(userEvents, new Set(), [fSeed, fCand], now);
    const autoplayCtx = buildCtx(autoplayEvents, new Set(), [fSeed, fCand], now);

    const candidates: CandidateInput[] = [{ track: cand, features: fCand }];
    const [bUser] = computeBreakdowns(userCtx, { track: seed, features: fSeed }, candidates);
    const [bAutoplay] = computeBreakdowns(autoplayCtx, { track: seed, features: fSeed }, candidates);

    expect(bUser.trackTransition).toBeCloseTo(2 / 3, 6);
    expect(bAutoplay.trackTransition).toBeCloseTo(0.6 / 1.6, 6);
    expect(bAutoplay.trackTransition).toBeLessThan(bUser.trackTransition);
  });

  it("applies recency penalty tiers by lastPlayedAt: -0.3 within 6h, -0.1 within 24h, 0 beyond", () => {
    const seed = makeTrack({ id: tid("seed") });
    const recent = makeTrack({ id: tid("recent"), lastPlayedAt: now - 3_600_000 });
    const mid = makeTrack({ id: tid("mid"), lastPlayedAt: now - 10 * 3_600_000 });
    const old = makeTrack({ id: tid("old"), lastPlayedAt: now - 3 * 86_400_000 });

    const ctx = buildCtx([], new Set(), [], now);
    const candidates: CandidateInput[] = [
      { track: recent, features: null },
      { track: mid, features: null },
      { track: old, features: null },
    ];
    const [bRecent, bMid, bOld] = computeBreakdowns(ctx, { track: seed, features: null }, candidates, DEFAULT_RECENCY_TIERS);

    expect(bRecent.recencyPenalty).toBe(-0.3);
    expect(bMid.recencyPenalty).toBe(-0.1);
    expect(bOld.recencyPenalty).toBe(0);
  });

  it("clamps a future lastPlayedAt (clock skew) to the strongest recency tier", () => {
    const seed = makeTrack({ id: tid("seed") });
    const future = makeTrack({ id: tid("future"), lastPlayedAt: now + 3_600_000 });

    const ctx = buildCtx([], new Set(), [], now);
    const candidates: CandidateInput[] = [{ track: future, features: null }];
    const [bFuture] = computeBreakdowns(ctx, { track: seed, features: null }, candidates, DEFAULT_RECENCY_TIERS);

    expect(bFuture.recencyPenalty).toBe(-0.3);
  });

  it("gives every candidate audio rank 0.5 and null audioSimilarity when the seed has no features", () => {
    const seed = makeTrack({ id: tid("seed") });
    const c1 = makeTrack({ id: tid("c1") });
    const c2 = makeTrack({ id: tid("c2") });
    const f1 = makeFeatures({ trackId: c1.id, bpm: 100 });
    const f2 = makeFeatures({ trackId: c2.id, bpm: 180 });

    const ctx = buildCtx([], new Set(), [f1, f2], now);
    const candidates: CandidateInput[] = [
      { track: c1, features: f1 },
      { track: c2, features: f2 },
    ];
    const breakdowns = computeBreakdowns(ctx, { track: seed, features: null }, candidates);

    for (const b of breakdowns) {
      expect(b.audioSimilarity).toBeNull();
      expect(b.ranks.audio).toBe(0.5);
    }
  });

  it("sets explore = 1 only for a candidate with no affinity history and features present", () => {
    const seed = makeTrack({ id: tid("seed") });
    const unplayedWithFeatures = makeTrack({ id: tid("unplayed-features") });
    const unplayedNoFeatures = makeTrack({ id: tid("unplayed-no-features") });
    const played = makeTrack({ id: tid("played") });

    const fUnplayed = makeFeatures({ trackId: unplayedWithFeatures.id, bpm: 100 });
    const fPlayed = makeFeatures({ trackId: played.id, bpm: 120 });
    const fSeed = makeFeatures({ trackId: seed.id, bpm: 90 });

    const events = [makeEvent("played", "art-played", now, { completed: true })];
    const ctx = buildCtx(events, new Set(), [fSeed, fUnplayed, fPlayed], now);

    const candidates: CandidateInput[] = [
      { track: unplayedWithFeatures, features: fUnplayed },
      { track: unplayedNoFeatures, features: null },
      { track: played, features: fPlayed },
    ];
    const [bUnplayedFeatures, bUnplayedNoFeatures, bPlayed] = computeBreakdowns(
      ctx,
      { track: seed, features: fSeed },
      candidates,
    );

    expect(bUnplayedFeatures.explore).toBe(1);
    expect(bUnplayedNoFeatures.explore).toBe(0);
    expect(bPlayed.explore).toBe(0);
  });

  it("with weights {audio:1, rest:0} orders candidates strictly by raw audioSimilarity", () => {
    const seed = makeTrack({ id: tid("seed") });
    const fSeed = makeFeatures({ trackId: seed.id, bpm: 100 });

    const tracks = ["c1", "c2", "c3", "c4"].map(id => makeTrack({ id: tid(id) }));
    // bpms kept within one octave of the seed so tempo-fold doesn't reorder distances.
    const bpms = [100, 110, 122, 138];
    const features = tracks.map((t, i) => makeFeatures({ trackId: t.id, bpm: bpms[i] }));

    // Noisy history that would reorder things under any non-zero weight elsewhere.
    const events = [
      makeEvent("c4", "art-c4", now, { completed: true }),
      makeEvent("seed", "art-seed", now - 60_000),
      makeEvent("c4", "art-c4", now - 30_000),
    ];
    const ctx = buildCtx(events, new Set([tid("c3")]), features, now);

    const candidates: CandidateInput[] = tracks.map((t, i) => ({ track: t, features: features[i] }));
    const weights = { audio: 1, trackTransition: 0, artistTransition: 0, affinity: 0, explore: 0 };
    const breakdowns = computeBreakdowns(ctx, { track: seed, features: fSeed }, candidates);
    const scored = candidates.map((c, i) => ({
      id: c.track.id,
      score: scoreBreakdown(breakdowns[i], weights),
      raw: breakdowns[i].audioSimilarity as number,
    }));

    const byScore = [...scored].sort((a, b) => b.score - a.score).map(s => s.id);
    const byRaw = [...scored].sort((a, b) => b.raw - a.raw).map(s => s.id);
    expect(byScore).toEqual(byRaw);
    expect(byScore).toEqual([tid("c1"), tid("c2"), tid("c3"), tid("c4")]);
  });

  it("scoreBreakdown(breakdown, weights) matches the score scoreCandidates computes for the same weights", () => {
    const seed = makeTrack({ id: tid("seed") });
    const c1 = makeTrack({ id: tid("c1") });
    const c2 = makeTrack({ id: tid("c2"), lastPlayedAt: now - 3_600_000 });
    const fSeed = makeFeatures({ trackId: seed.id, bpm: 100 });
    const f1 = makeFeatures({ trackId: c1.id, bpm: 105 });
    const f2 = makeFeatures({ trackId: c2.id, bpm: 150 });

    const events = [
      makeEvent("seed", "art-seed", now - 3600_000),
      makeEvent("c1", "art-c1", now - 3600_000 + 30_000),
    ];
    const ctx = buildCtx(events, new Set([tid("c2")]), [fSeed, f1, f2], now);

    const candidates: CandidateInput[] = [
      { track: c1, features: f1 },
      { track: c2, features: f2 },
    ];
    const scored = scoreCandidates(ctx, { track: seed, features: fSeed }, candidates, DEFAULT_WEIGHTS);
    for (const s of scored) {
      expect(scoreBreakdown(s.breakdown, DEFAULT_WEIGHTS)).toBe(s.score);
    }
  });
});

describe("ranksToVector", () => {
  it("returns values in COMPONENT_KEYS order", () => {
    const ranks: ComponentRanks = { audio: 0.1, trackTransition: 0.2, artistTransition: 0.3, affinity: 0.4, explore: 1 };
    expect(ranksToVector(ranks)).toEqual(COMPONENT_KEYS.map(k => ranks[k]));
  });
});
