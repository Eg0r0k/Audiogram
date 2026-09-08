import { describe, it, expect } from "vitest";
import type { AudioFeaturesEntity, TrackEntity } from "@/db/entities";
import type { ArtistId, TrackId } from "@/types/ids";
import { COMPONENT_KEYS, type CandidateInput, type ScoringContext } from "./scoring";
import type { Session, SessionEvent } from "./sessions";
import {
  extractAutoplayRuns,
  labelOf,
  buildExamples,
  trainWeights,
  blendWeights,
  dot,
  DEFAULT_TRAIN_OPTIONS,
  type BuildExamplesInput,
  type TrainingExample,
} from "./training";

const tid = (s: string) => s as TrackId;
const aid = (s: string) => s as ArtistId;

const se = (
  id: string,
  origin: SessionEvent["origin"],
  startedAt: number,
  overrides: Partial<SessionEvent> = {},
): SessionEvent => ({
  trackId: tid(id),
  artistId: aid(`art-${id}`),
  startedAt,
  skipped: false,
  completed: true,
  origin,
  secondsListened: 180,
  ...overrides,
});

describe("extractAutoplayRuns", () => {
  it("splits a session into maximal autoplay runs, each seeded by the nearest preceding user event", () => {
    const session: Session = [
      se("u1", "user", 0),
      se("a1", "autoplay", 100),
      se("a2", "autoplay", 200),
      se("u2", "user", 300),
      se("a3", "autoplay", 400),
    ];
    const runs = extractAutoplayRuns([session]);

    expect(runs).toHaveLength(2);
    expect(runs[0].seed.trackId).toBe(tid("u1"));
    expect(runs[0].targets.map(t => t.trackId)).toEqual([tid("a1"), tid("a2")]);
    expect(runs[0].startedAt).toBe(100);
    expect(runs[1].seed.trackId).toBe(tid("u2"));
    expect(runs[1].targets.map(t => t.trackId)).toEqual([tid("a3")]);
    expect(runs[1].startedAt).toBe(400);
  });

  it("drops a run with no preceding user event", () => {
    const session: Session = [
      se("a1", "autoplay", 100),
      se("a2", "autoplay", 200),
      se("u1", "user", 300),
    ];
    expect(extractAutoplayRuns([session])).toEqual([]);
  });

  it("skips an event whose origin is neither user nor autoplay instead of spinning", () => {
    const session: Session = [
      se("u1", "user", 0),
      { ...se("x", "autoplay", 100), origin: "other" as unknown as SessionEvent["origin"] },
      se("a1", "autoplay", 200),
    ];
    const runs = extractAutoplayRuns([session]);
    expect(runs).toHaveLength(1);
    expect(runs[0].targets.map(t => t.trackId)).toEqual([tid("a1")]);
  });

  it("uses a skipped user event as a seed", () => {
    const session: Session = [
      se("u1", "user", 0, { skipped: true, completed: false, secondsListened: 5 }),
      se("a1", "autoplay", 100),
    ];
    const runs = extractAutoplayRuns([session]);
    expect(runs).toHaveLength(1);
    expect(runs[0].seed.trackId).toBe(tid("u1"));
  });
});

describe("labelOf", () => {
  it("labels a completed event as 1", () => {
    expect(labelOf(se("t", "autoplay", 0, { completed: true }), 30)).toBe(1);
  });

  it("labels an early skip (< earlySkipSeconds) as 0", () => {
    expect(labelOf(se("t", "autoplay", 0, { completed: false, skipped: true, secondsListened: 5 }), 30)).toBe(0);
  });

  it("labels a late skip (>= earlySkipSeconds) as null", () => {
    expect(labelOf(se("t", "autoplay", 0, { completed: false, skipped: true, secondsListened: 90 }), 30)).toBeNull();
  });

  it("labels a partial play (not completed, not skipped) as null", () => {
    expect(labelOf(se("t", "autoplay", 0, { completed: false, skipped: false, secondsListened: 50 }), 30)).toBeNull();
  });
});

const makeTrack = (id: string): TrackEntity => ({
  id: tid(id),
  title: id,
  artistName: "Artist",
  albumTitle: "Album",
  artistIds: [aid(`art-${id}`)],
  albumId: "album-default" as any,
  tagIds: [],
  source: "local_internal" as any,
  pinned: 1,
  state: 0,
  duration: 200,
  format: {},
  playCount: 0,
  addedAt: 0,
});

const makeFeatures = (id: string): AudioFeaturesEntity => ({
  trackId: tid(id),
  bpm: 100,
  energy: 0.5,
  spectralCentroid: 2000,
  danceability: 0.6,
  key: 0,
  mode: 1,
  analyzedAt: 0,
  algorithmVersion: 1,
});

const emptyCtx: ScoringContext = {
  now: 0,
  audioSpace: null,
  transitions: { tracks: new Map(), artists: new Map() },
  affinity: new Map(),
};

describe("buildExamples", () => {
  it("builds the context once per chunk, and one example per labelled target", () => {
    const trackIds = ["u1", "a1", "u2", "a2", "u3", "a3"];
    const tracks = new Map(trackIds.map(id => [tid(id), makeTrack(id)]));
    const features = new Map(trackIds.map(id => [tid(id), makeFeatures(id)]));

    const runs = [
      { seed: se("u1", "user", 0), targets: [se("a1", "autoplay", 10, { completed: true })], startedAt: 10 },
      { seed: se("u2", "user", 20), targets: [se("a2", "autoplay", 30, { completed: false, skipped: true, secondsListened: 5 })], startedAt: 30 },
      { seed: se("u3", "user", 40), targets: [se("a3", "autoplay", 50, { completed: false, skipped: false, secondsListened: 50 })], startedAt: 50 },
    ];

    let buildContextCalls = 0;
    const input: BuildExamplesInput = {
      runs,
      buildContextAt: () => {
        buildContextCalls++;
        return { ctx: emptyCtx, tracks, features };
      },
      sampleCandidates: () => [],
      chunkSize: 2,
    };

    const examples = buildExamples(input);

    expect(buildContextCalls).toBe(2);
    // run 1 -> completed (y=1), run 2 -> early skip (y=0), run 3 -> partial (null, dropped)
    expect(examples).toHaveLength(2);
    for (const ex of examples) expect(ex.x).toHaveLength(COMPONENT_KEYS.length);
    expect(examples.map(e => e.y)).toEqual([1, 0]);
  });

  it("skips a run whose seed track is missing", () => {
    const tracks = new Map<TrackId, TrackEntity>([[tid("a1"), makeTrack("a1")]]);
    const features = new Map<TrackId, AudioFeaturesEntity>();
    const runs = [
      { seed: se("missing-seed", "user", 0), targets: [se("a1", "autoplay", 10, { completed: true })], startedAt: 10 },
    ];

    const examples = buildExamples({
      runs,
      buildContextAt: () => ({ ctx: emptyCtx, tracks, features }),
      sampleCandidates: () => [],
    });

    expect(examples).toEqual([]);
  });

  it("includes sampled candidates alongside targets when computing breakdowns", () => {
    const trackIds = ["u1", "a1", "extra"];
    const tracks = new Map(trackIds.map(id => [tid(id), makeTrack(id)]));
    const features = new Map(trackIds.map(id => [tid(id), makeFeatures(id)]));
    const runs = [
      { seed: se("u1", "user", 0), targets: [se("a1", "autoplay", 10, { completed: true })], startedAt: 10 },
    ];

    let sampledExclude: ReadonlySet<TrackId> | null = null;
    const sampleCandidates = (n: number, exclude: ReadonlySet<TrackId>): CandidateInput[] => {
      sampledExclude = exclude;
      return [{ track: tracks.get(tid("extra"))!, features: features.get(tid("extra")) ?? null }];
    };

    const examples = buildExamples({
      runs,
      buildContextAt: () => ({ ctx: emptyCtx, tracks, features }),
      sampleCandidates,
    });

    expect(examples).toHaveLength(1);
    expect(sampledExclude).not.toBeNull();
    expect([...sampledExclude!]).toEqual(expect.arrayContaining([tid("u1"), tid("a1")]));
  });
});

const lcg = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
};

describe("trainWeights", () => {
  it("learns the audio component as the dominant weight on a synthetic signal", () => {
    const rand = lcg(42);
    const audioIdx = COMPONENT_KEYS.indexOf("audio");
    const examples: TrainingExample[] = [];
    for (let i = 0; i < 200; i++) {
      const x = COMPONENT_KEYS.map(() => rand());
      const y = x[audioIdx] > 0.6 ? 1 : 0;
      examples.push({ x, y, at: i });
    }

    const weights = trainWeights(examples);
    expect(weights).not.toBeNull();
    const w = weights!;
    for (const key of COMPONENT_KEYS) expect(w[key]).toBeGreaterThanOrEqual(0);

    const maxKey = COMPONENT_KEYS.reduce((best, k) => (w[k] > w[best] ? k : best));
    expect(maxKey).toBe("audio");
    expect(w.audio).toBeGreaterThan(0.5);
  });

  it("returns null when there are fewer than minNegatives negatives", () => {
    const examples: TrainingExample[] = [];
    for (let i = 0; i < 20; i++) examples.push({ x: [1, 1, 1, 1, 1], y: 1, at: i });
    for (let i = 0; i < 10; i++) examples.push({ x: [0, 0, 0, 0, 0], y: 0, at: i });
    expect(trainWeights(examples)).toBeNull();
    expect(DEFAULT_TRAIN_OPTIONS.minNegatives).toBe(15);
  });

  it("returns null when there are fewer than minPositives positives", () => {
    const examples: TrainingExample[] = [];
    for (let i = 0; i < 10; i++) examples.push({ x: [1, 1, 1, 1, 1], y: 1, at: i });
    for (let i = 0; i < 20; i++) examples.push({ x: [0, 0, 0, 0, 0], y: 0, at: i });
    expect(trainWeights(examples)).toBeNull();
  });
});

describe("blendWeights", () => {
  const base = { audio: 0.35, trackTransition: 0.25, artistTransition: 0.1, affinity: 0.2, explore: 0.1 };
  const learned = { audio: 0.6, trackTransition: 0.1, artistTransition: 0.1, affinity: 0.1, explore: 0.1 };

  it("returns base with 0 examples", () => {
    expect(blendWeights(base, learned, 0)).toEqual(base);
  });

  it("returns learned at or beyond fullAt examples", () => {
    expect(blendWeights(base, learned, 200)).toEqual(learned);
    expect(blendWeights(base, learned, 500)).toEqual(learned);
  });

  it("blends halfway at half of fullAt examples", () => {
    const blended = blendWeights(base, learned, 100);
    for (const key of COMPONENT_KEYS) {
      expect(blended[key]).toBeCloseTo((base[key] + learned[key]) / 2, 10);
    }
  });
});

describe("dot", () => {
  it("sums x[i] * w[COMPONENT_KEYS[i]] in COMPONENT_KEYS order", () => {
    const w = { audio: 2, trackTransition: 3, artistTransition: 5, affinity: 7, explore: 11 };
    const x = COMPONENT_KEYS.map((_, i) => i + 1);
    expect(dot(x, w)).toBe(1 * 2 + 2 * 3 + 3 * 5 + 4 * 7 + 5 * 11);
  });

  it("returns 0 for an all-zero vector", () => {
    const w = { audio: 1, trackTransition: 1, artistTransition: 1, affinity: 1, explore: 1 };
    expect(dot([0, 0, 0, 0, 0], w)).toBe(0);
  });
});
