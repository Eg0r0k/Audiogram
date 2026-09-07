import { describe, it, expect } from "vitest";
import type { ListenEventEntity, TrackEntity } from "@/db/entities";
import { TrackSource, TrackState } from "@/db/entities";
import type { TrackId } from "@/types/ids";
import { buildRecommendationContextFromData } from "@/modules/recommendations/service/recommendation-context";
import { collectSignalMatrix } from "@/modules/recommendations/service/signals";
import { scoreMatrix, selectTop, DEFAULT_WEIGHTS } from "@/modules/recommendations/service/scoring";
import { candidateIdsFor } from "@/modules/recommendations/service/recommender.service";

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
    artistIds: [`a${i % ARTISTS}` as any], albumId: `al${i % 300}` as any,
    tagIds: [`g${i % 12}`, `g${(i * 7) % 12}`] as any,
    source: TrackSource.LOCAL_INTERNAL, state: TrackState.READY, duration: 200,
    format: { codec: "MP3", bitrate: 320000, sampleRate: 44100, lossless: false, channels: 2 },
    pinned: 0 as any, playCount: 0, addedAt: 0,
    likedAt: rnd() < 0.2 ? 1 : undefined,
    lastPlayedAt: rnd() < 0.7 ? now - rnd() * 90 * DAY : undefined,
  }));
  const events: ListenEventEntity[] = [];
  let t = now - 90 * DAY;
  for (let i = 0; i < EVENTS; i++) {
    t += rnd() < 0.1 ? 60 * 60_000 : 3 * 60_000;
    const track = tracks[Math.floor(rnd() * TRACKS)];
    events.push({
      id: `e${i}`, trackId: track.id, artistId: track.artistIds[0], albumId: track.albumId,
      startedAt: t, secondsListened: 150, trackDuration: 200,
      completed: rnd() < 0.7, skipped: rnd() < 0.15,
    });
  }
  return { tracks, events, now };
};

const timed = <T>(fn: () => T): [T, number] => {
  const start = performance.now();
  const result = fn();
  return [result, performance.now() - start];
};

describe("recommender perf budget", () => {
  const { tracks, events, now } = build();

  it(`builds the context for ${TRACKS} tracks / ${EVENTS} events under ${BUDGET_MS} ms`, () => {
    buildRecommendationContextFromData(tracks, events, now);
    const [, ms] = timed(() => buildRecommendationContextFromData(tracks, events, now));
    console.log(`context: ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it(`signals + scoring for ${TRACKS} candidates under ${BUDGET_MS} ms`, () => {
    const ctx = buildRecommendationContextFromData(tracks, events, now);
    const source = tracks[3].id;
    const candidates = candidateIdsFor(source, ctx, 5, []);
    const run = () => {
      const m = collectSignalMatrix(source, candidates, ctx);
      const s = scoreMatrix(m, DEFAULT_WEIGHTS);
      return selectTop(m, s, 8, 2);
    };
    run();
    const [rows, ms] = timed(run);
    console.log(`signals+scoring: ${ms.toFixed(1)} ms`);
    expect(rows.length).toBe(8);
    expect(ms).toBeLessThan(BUDGET_MS);
  });
});
