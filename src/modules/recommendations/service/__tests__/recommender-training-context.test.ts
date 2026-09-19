import { describe, it, expect, vi } from "vitest";
import type { AudioFeaturesEntity, ListenEventEntity, TrackEntity } from "@/db/entities";
import { TrackSource, TrackState } from "@/db/entities";
import type { AlbumId, ArtistId, TrackId } from "@/types/ids";

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/db/repositories", () => ({ trackRepository: { findAll: vi.fn() } }));
vi.mock("@/db/repositories/stats.repository", () => ({
  statsRepository: {},
  SESSION_GAP_MS: 30 * 60 * 1000,
}));
vi.mock("@/db/repositories/audioFeatures.repository", () => ({
  audioFeaturesRepository: { findAll: vi.fn() },
  CURRENT_ALGORITHM_VERSION: 1,
}));

const { buildRecommenderContext } = await import(
  "@/modules/recommendations/service/recommender-context.service"
);
const { buildContextAtFactory, sampleCandidatesFactory } = await import(
  "@/modules/recommendations/service/recommender-training-context"
);

const tid = (s: string) => s as TrackId;
const DAY = 86_400_000;
const NOW = 1_800_000_000_000;
const CUTOFF = NOW - DAY;
const OLD_COUNT = 12;

const makeTrack = (id: string, addedAt: number): TrackEntity => ({
  id: tid(id),
  title: `Track ${id}`,
  artistName: "Artist",
  albumTitle: "Album",
  artistIds: [`ar-${id}` as ArtistId],
  albumId: "al" as AlbumId,
  tagIds: [],
  source: TrackSource.LOCAL_INTERNAL,
  storagePath: `tracks/${id}.mp3`,
  state: TrackState.READY,
  duration: 200,
  format: { codec: "MP3", bitrate: 320000, sampleRate: 44100, lossless: false, channels: 2 },
  pinned: 0,
  playCount: 0,
  addedAt,
});

const makeFeatures = (id: string, bpm: number): AudioFeaturesEntity => ({
  trackId: tid(id),
  bpm,
  energy: 0.5,
  spectralCentroid: 2000,
  danceability: 0.5,
  key: 0,
  mode: 1,
  analyzedAt: 0,
  algorithmVersion: 1,
});

const makeEvent = (id: string, startedAt: number): ListenEventEntity => ({
  id: `${id}-${startedAt}`,
  trackId: tid(id),
  artistId: `ar-${id}` as ArtistId,
  albumId: "al" as AlbumId,
  startedAt,
  secondsListened: 180,
  trackDuration: 200,
  completed: true,
  skipped: false,
  origin: "user",
});

const oldIds = Array.from({ length: OLD_COUNT }, (_, i) => tid(`old${i}`));

/** OLD_COUNT tracks that predate the cutoff, plus one imported after it. */
const makeCtx = () => buildRecommenderContext({
  tracks: [
    ...oldIds.map((id, i) => makeTrack(id, NOW - (10 - i / OLD_COUNT) * DAY)),
    makeTrack("new", NOW - DAY / 2),
  ],
  features: [
    ...oldIds.map((id, i) => makeFeatures(id, 100 + i)),
    makeFeatures("new", 140),
  ],
  events: [makeEvent("old0", NOW - 8 * DAY), makeEvent("old1", NOW - 8 * DAY + 60_000)],
  now: NOW,
});

describe("buildContextAtFactory", () => {
  it("drops tracks and features added after the cutoff", () => {
    const built = buildContextAtFactory(makeCtx())(CUTOFF);

    expect([...built.tracks.keys()].sort()).toEqual([...oldIds].sort());
    expect(built.tracks.has(tid("new"))).toBe(false);
    expect(built.features.has(tid("new"))).toBe(false);
  });

  it("keeps the pre-cutoff library and events, so seed lookups still resolve", () => {
    const built = buildContextAtFactory(makeCtx())(CUTOFF);

    expect(built.tracks.get(tid("old0"))).toBeDefined();
    expect(built.ctx.affinity.has(tid("old0"))).toBe(true);
  });
});

describe("sampleCandidatesFactory", () => {
  it("never samples a track added after the cutoff", () => {
    const sample = sampleCandidatesFactory(makeCtx());
    for (let i = 0; i < 20; i++) {
      const ids = sample(OLD_COUNT + 1, new Set<TrackId>(), CUTOFF).map(c => c.track.id);
      expect(ids).not.toContain(tid("new"));
      expect(ids).toHaveLength(OLD_COUNT);
    }
  });

  it("honours the exclusion set", () => {
    const sample = sampleCandidatesFactory(makeCtx());
    const ids = sample(OLD_COUNT, new Set<TrackId>([tid("old0")]), CUTOFF).map(c => c.track.id);
    expect(ids).not.toContain(tid("old0"));
    expect(ids).toHaveLength(OLD_COUNT - 1);
  });

  it("varies the draw between calls but stays identical across two factories over the same input", () => {
    const a = sampleCandidatesFactory(makeCtx());
    const b = sampleCandidatesFactory(makeCtx());

    const draw = (sample: ReturnType<typeof sampleCandidatesFactory>) =>
      sample(6, new Set<TrackId>(), CUTOFF).map(c => c.track.id).join(",");
    const seqA = Array.from({ length: 8 }, () => draw(a));
    const seqB = Array.from({ length: 8 }, () => draw(b));

    expect(seqA).toEqual(seqB);
    // One fixed seed would repeat a single background sample for every run.
    expect(new Set(seqA).size).toBeGreaterThan(1);
  });
});
