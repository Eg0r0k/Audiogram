import type { AudioFeaturesEntity, TrackEntity } from "@/db/entities";
import { normalize } from "@/lib/math";
import type { ArtistId, TrackId } from "@/types/ids";
import type { RecommendationContext } from "./recommendation-context";
import type { CoOccurrence } from "./session-builder.service";

export const SIGNAL_KEYS = [
  "audioSimilarity",
  "coOccurrence",
  "artistCoOccurrence",
  "sameArtist",
  "tagOverlap",
  "artistAffinity",
  "completionRate",
  "skipRate",
  "liked",
  "recency",
  "novelty",
] as const;

export type SignalKey = typeof SIGNAL_KEYS[number];
export type SignalVector = Record<SignalKey, number>;
export type Weights = Record<SignalKey, number>;

export interface FeatureVector {
  bpm: number;
  energy: number;
  spectralCentroid: number;
  danceability: number;
  key: number;
  mode: number;
}

export const toVector = (f: AudioFeaturesEntity): FeatureVector => ({
  bpm: normalize(f.bpm, 250),
  energy: f.energy,
  spectralCentroid: normalize(f.spectralCentroid, 8000),
  danceability: f.danceability,
  key: normalize(f.key, 11),
  mode: f.mode,
});

export interface AudioLookup {
  source: FeatureVector | null;
  byId: Map<TrackId, FeatureVector>;
}

export interface SessionExclusion {
  tracks: Set<TrackId>;
  artists: Set<ArtistId>;
}

export interface SignalOptions {
  audio?: AudioLookup;
  exclude?: SessionExclusion;
}

export interface SignalMatrix {
  candidateIds: TrackId[];
  artistKeys: string[];
  data: Float32Array;
}

const RECENCY_DECAY_MS = 30 * 86_400_000;
const FEATURE_KEYS = ["bpm", "energy", "spectralCentroid", "danceability", "key", "mode"] as const;
const MAX_FEATURE_DIST = Math.sqrt(FEATURE_KEYS.length);

export const artistKeyOf = (track: TrackEntity): string => track.artistIds[0] ?? track.artistName;

const euclideanSimilarity = (a: FeatureVector, b: FeatureVector): number => {
  let sumSq = 0;
  for (const k of FEATURE_KEYS) {
    const d = a[k] - b[k];
    sumSq += d * d;
  }
  return 1 - Math.sqrt(sumSq) / MAX_FEATURE_DIST;
};

const jaccard = (a: readonly string[], b: readonly string[]): number => {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let inter = 0;
  for (const x of a) if (setB.has(x)) inter++;
  const union = a.length + b.length - inter;
  return union === 0 ? 0 : inter / union;
};

/**
 * Cosine-normalized co-occurrence of `sources` against any id, with an
 * optional session subtracted so a held-out transition cannot see itself.
 * `norm(x)` is the max over `sources`; `max` is the max over every pair of
 * every source — 0 when the sources appear in no session.
 */
const makeCoLookup = <Id>(
  co: CoOccurrence<Id>,
  sources: readonly Id[],
  excluded: ReadonlySet<Id> | undefined,
) => {
  const countOf = (id: Id): number =>
    (co.sessionCounts.get(id) ?? 0) - (excluded?.has(id) ? 1 : 0);
  const rawOf = (a: Id, b: Id): number =>
    (co.raw.get(a)?.get(b) ?? 0) - (excluded?.has(a) && excluded.has(b) ? 1 : 0);
  const normOf = (a: Id, b: Id): number => {
    const raw = rawOf(a, b);
    if (raw <= 0) return 0;
    const ca = countOf(a);
    const cb = countOf(b);
    return ca > 0 && cb > 0 ? raw / Math.sqrt(ca * cb) : 0;
  };

  let max = 0;
  for (const s of sources) {
    const pairs = co.raw.get(s);
    if (!pairs) continue;
    for (const other of pairs.keys()) {
      if (other === s) continue;
      const v = normOf(s, other);
      if (v > max) max = v;
    }
  }

  const norm = (candidates: readonly Id[]): number => {
    if (max === 0) return 0;
    let best = 0;
    for (const s of sources) {
      for (const c of candidates) {
        if (c === s) continue;
        const v = normOf(s, c);
        if (v > best) best = v;
      }
    }
    return best / max;
  };

  return { norm };
};

const makeSourceScope = (
  sourceId: TrackId,
  ctx: RecommendationContext,
  options: SignalOptions,
) => {
  const source = ctx.tracks.get(sourceId);
  const sourceArtists = source?.artistIds ?? [];
  const sourceTags = source?.tagIds ?? [];
  const trackCo = makeCoLookup(ctx.trackCo, [sourceId], options.exclude?.tracks);
  const artistCo = makeCoLookup(ctx.artistCo, sourceArtists, options.exclude?.artists);
  const logMaxArtist = Math.log1p(ctx.maxArtistSeconds);
  const audioSource = options.audio?.source ?? null;
  const audioById = options.audio?.byId;

  return (candidate: TrackEntity): SignalVector => {
    const stats = ctx.trackStats.get(candidate.id);
    const nonSkipped = stats ? stats.total - stats.skipped : 0;

    let affinity = 0;
    if (logMaxArtist > 0) {
      for (const a of candidate.artistIds) {
        const sec = ctx.artistSeconds.get(a);
        if (sec) affinity = Math.max(affinity, Math.log1p(sec) / logMaxArtist);
      }
    }

    const age = candidate.lastPlayedAt ? ctx.now - candidate.lastPlayedAt : null;
    const recency = age === null ? 0.6 : Math.exp(-age / RECENCY_DECAY_MS);
    const novelty = age === null ? 1 : 1 - Math.exp(-age / RECENCY_DECAY_MS);

    const candidateAudio = audioById?.get(candidate.id);

    return {
      audioSimilarity: audioSource && candidateAudio ? euclideanSimilarity(audioSource, candidateAudio) : 0,
      coOccurrence: trackCo.norm([candidate.id]),
      artistCoOccurrence: artistCo.norm(candidate.artistIds),
      sameArtist: candidate.artistIds.some(a => sourceArtists.includes(a)) ? 1 : 0,
      tagOverlap: jaccard(sourceTags, candidate.tagIds),
      artistAffinity: affinity,
      completionRate: stats && nonSkipped > 0 ? stats.completed / nonSkipped : 0.5,
      skipRate: stats && stats.total > 0 ? 1 - stats.skipped / stats.total : 0.5,
      liked: candidate.likedAt ? 1 : 0,
      recency,
      novelty,
    };
  };
};

export const collectSignals = (
  sourceId: TrackId,
  candidateId: TrackId,
  ctx: RecommendationContext,
  options: SignalOptions = {},
): SignalVector => {
  const candidate = ctx.tracks.get(candidateId);
  const scope = makeSourceScope(sourceId, ctx, options);
  if (!candidate) {
    return Object.fromEntries(SIGNAL_KEYS.map(k => [k, 0])) as SignalVector;
  }
  return scope(candidate);
};

export const collectSignalMatrix = (
  sourceId: TrackId,
  candidateIds: readonly TrackId[],
  ctx: RecommendationContext,
  options: SignalOptions = {},
): SignalMatrix => {
  const scope = makeSourceScope(sourceId, ctx, options);
  const k = SIGNAL_KEYS.length;
  const ids: TrackId[] = [];
  const artistKeys: string[] = [];
  const data = new Float32Array(candidateIds.length * k);
  let row = 0;
  for (const id of candidateIds) {
    const track = ctx.tracks.get(id);
    if (!track) continue;
    const v = scope(track);
    const base = row * k;
    for (let i = 0; i < k; i++) data[base + i] = v[SIGNAL_KEYS[i]];
    ids.push(id);
    artistKeys.push(artistKeyOf(track));
    row++;
  }
  return { candidateIds: ids, artistKeys, data: row === candidateIds.length ? data : data.slice(0, row * k) };
};
