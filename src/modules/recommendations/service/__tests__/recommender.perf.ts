import { describe, it, expect } from "vitest";
import type { AudioFeaturesEntity, ListenEventEntity, TrackEntity } from "@/db/entities";
import { TrackSource, TrackState } from "@/db/entities";
import { DEFAULT_MMR_OPTIONS, mmrSelect } from "@/modules/recommendations/lib/rank";
import { computeBreakdowns, DEFAULT_WEIGHTS, scoreBreakdown, type CandidateInput } from "@/modules/recommendations/lib/scoring";
import { buildRecommenderContext } from "@/modules/recommendations/service/recommender-context.service";
import type { AlbumId, ArtistId, TagId, TrackId } from "@/types/ids";

const TRACKS = 1000;
const ARTISTS = 200;
const EVENTS = 20_000;
const DAY = 86_400_000;
const BUDGET_MS = 200;

const lcg = (seed: number) => () => {
  seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
  return seed / 0x1_0000_0000;
};

const build = () => {
  const rnd = lcg(7);
  const now = 1_800_000_000_000;
  const tracks: TrackEntity[] = Array.from({ length: TRACKS }, (_, i) => ({
    id: `t${i}` as TrackId,
    title: `Track ${i}`, artistName: `Artist ${i % ARTISTS}`, albumTitle: "",
    artistIds: [`a${i % ARTISTS}` as ArtistId], albumId: `al${i % 300}` as AlbumId,
    tagIds: [`g${i % 12}`, `g${(i * 7) % 12}`] as TagId[],
    source: TrackSource.LOCAL_INTERNAL, state: TrackState.READY, duration: 200,
    format: { codec: "MP3", bitrate: 320000, sampleRate: 44100, lossless: false, channels: 2 },
    pinned: 0 as const, playCount: 0, addedAt: 0,
    likedAt: rnd() < 0.2 ? 1 : undefined,
    lastPlayedAt: rnd() < 0.7 ? now - rnd() * 90 * DAY : undefined,
  }));
  const features: AudioFeaturesEntity[] = tracks.map(t => ({
    trackId: t.id,
    bpm: 60 + rnd() * 140,
    energy: rnd(),
    spectralCentroid: 500 + rnd() * 5000,
    danceability: rnd(),
    key: Math.floor(rnd() * 12),
    mode: rnd() < 0.5 ? 0 : 1,
    analyzedAt: now,
    algorithmVersion: 1,
  }));
  const events: ListenEventEntity[] = [];
  let t = now - 90 * DAY;
  for (let i = 0; i < EVENTS; i++) {
    t += rnd() < 0.1 ? 60 * 60_000 : 3 * 60_000;
    const track = tracks[Math.floor(rnd() * TRACKS)];
    events.push({
      id: `e${i}`, trackId: track.id, artistId: track.artistIds[0], albumId: track.albumId,
      startedAt: t, secondsListened: 150, trackDuration: 200,
      completed: rnd() < 0.7, skipped: rnd() < 0.15, origin: "user",
    });
  }
  return { tracks, features, events, now };
};

const timed = <T>(fn: () => T): [T, number] => {
  const start = performance.now();
  const result = fn();
  return [result, performance.now() - start];
};

describe("recommender perf budget", () => {
  const { tracks, features, events, now } = build();
  const input = { tracks, features, events, now };

  it(`builds the context for ${TRACKS} tracks / ${EVENTS} events under ${BUDGET_MS} ms`, () => {
    buildRecommenderContext(input);
    const [, ms] = timed(() => buildRecommenderContext(input));
    console.log(`context: ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it(`components + scoring for ${TRACKS} candidates under ${BUDGET_MS} ms`, () => {
    const ctx = buildRecommenderContext(input);
    const seedTrack = tracks[3];
    const seed = { track: seedTrack, features: ctx.features.get(seedTrack.id) ?? null };
    const candidates: CandidateInput[] = [];
    for (const [id, track] of ctx.tracks) {
      if (id === seedTrack.id) continue;
      candidates.push({ track, features: ctx.features.get(id) ?? null });
    }
    const run = () => {
      const breakdowns = computeBreakdowns(ctx, seed, candidates);
      const scored = candidates.map((c, i) => ({
        trackId: c.track.id, artistIds: c.track.artistIds, albumId: c.track.albumId,
        score: scoreBreakdown(breakdowns[i], DEFAULT_WEIGHTS),
      }));
      return mmrSelect(scored, 8, DEFAULT_MMR_OPTIONS);
    };
    run();
    const [rows, ms] = timed(run);
    console.log(`components+scoring: ${ms.toFixed(1)} ms`);
    expect(rows.length).toBe(8);
    expect(ms).toBeLessThan(BUDGET_MS);
  });
});
