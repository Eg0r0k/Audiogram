import { computed, reactive, ref, shallowRef, watch } from "vue";
import type { TrackEntity } from "@/db/entities";
import { getLogger } from "@/lib/logger";
import { mapTrackEntityToPlayerTrack } from "@/modules/player/utils/trackEntity";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import type { TrackId } from "@/types/ids";
import { DEFAULT_MMR_OPTIONS, type MmrOptions } from "../lib/rank";
import {
  breakdownsToRankMatrix,
  computeBreakdowns,
  DEFAULT_WEIGHTS,
  type CandidateInput,
  type ComponentWeights,
  type SeedInput,
} from "../lib/scoring";
import { buildTransitions, subtractTransitions } from "../lib/transitions";
import { getRecommenderContext, markRecommenderContextDirty, type RecommenderContext } from "../service/recommender-context.service";
import { RECENT_EXCLUDE } from "../service/recommender.service";
import { pickFeedBatch, splitFeed, type FeedEntry, type FeedSplit } from "../service/stand-feed";
import { loadFeedback, pairKey, saveFeedback, writeSnapshot, type FeedbackEntry, type FeedbackLabel } from "../service/stand-feedback.store";
import { hitRate, pairAgreement, sampleTransitions, type AgreementCase, type TransitionCase } from "../service/stand-metrics";
import { createTuner } from "../service/stand-tuner";

export interface StandParams {
  limit: number;
  recentWindow: number;
  maxPerArtist: number;
  artistPenalty: number;
  albumPenalty: number;
}

/** `limit` is both the feed batch size and N for hit@N. */
export const DEFAULT_STAND_PARAMS: StandParams = {
  limit: 3,
  recentWindow: RECENT_EXCLUDE,
  maxPerArtist: DEFAULT_MMR_OPTIONS.maxPerArtist,
  artistPenalty: DEFAULT_MMR_OPTIONS.artistPenalty,
  albumPenalty: DEFAULT_MMR_OPTIONS.albumPenalty,
};

export interface StandTimings { contextMs: number; batchMs: number }

/** Rank matrix of a source's full candidate set, plus where each candidate sits. */
interface SourceRanks {
  ranks: Float32Array;
  rowOf: Map<TrackId, number>;
}

const HIT_SAMPLE = 200;
const HIT_SEED = 42;
const CHUNK = 10;

const ctx = shallowRef<RecommenderContext | null>(null);
const isLoading = ref(false);
const seedId = ref<TrackId | null>(null);
const weights = reactive<ComponentWeights>({ ...DEFAULT_WEIGHTS });
const params = reactive<StandParams>({ ...DEFAULT_STAND_PARAMS });
const timings = ref<StandTimings>({ contextMs: 0, batchMs: 0 });
const feedback = ref<Map<string, FeedbackEntry>>(new Map());
const feed = ref<Map<TrackId, FeedEntry>>(new Map());
const transitionCases = shallowRef<TransitionCase[]>([]);
const hitProgress = ref({ done: 0, total: 0 });
const tuneProgress = ref<{ done: number; total: number } | null>(null);
const tuneUsesAgreement = ref<boolean | null>(null);

// Bumped by every (re)load: a build started before the bump is stale.
let generation = 0;

let ratedRanks = new Map<TrackId, SourceRanks>();
let ratedRanksCtx: RecommenderContext | null = null;
let ratedRanksWindow = -1;

const yieldToUi = () => new Promise<void>(resolve => setTimeout(resolve, 0));

const now = () => performance.now();

const mmrOptions = (): MmrOptions => ({
  artistPenalty: params.artistPenalty,
  albumPenalty: params.albumPenalty,
  maxPerArtist: params.maxPerArtist,
});

const excludedFor = (c: RecommenderContext, seed: TrackId): Set<TrackId> => {
  const excluded = new Set<TrackId>([seed]);
  for (const recent of c.recentlyPlayed.slice(0, Math.max(0, params.recentWindow))) excluded.add(recent);
  return excluded;
};

const candidatesFor = (c: RecommenderContext, excluded: ReadonlySet<TrackId>): CandidateInput[] => {
  const out: CandidateInput[] = [];
  for (const [id, track] of c.tracks) {
    if (excluded.has(id)) continue;
    out.push({ track, features: c.features.get(id) ?? null });
  }
  return out;
};

const seedFor = (c: RecommenderContext, track: TrackEntity): SeedInput =>
  ({ track, features: c.features.get(track.id) ?? null });

const buildTransitionCases = async (c: RecommenderContext, gen: number) => {
  const transitions = sampleTransitions(c.sessions, HIT_SAMPLE, HIT_SEED);
  if (gen !== generation) return;
  hitProgress.value = { done: 0, total: transitions.length };
  const out: TransitionCase[] = [];
  for (let i = 0; i < transitions.length; i++) {
    const { session, index } = transitions[i];
    const seedTrack = c.tracks.get(session[index].trackId);
    const targetId = session[index + 1].trackId;
    if (seedTrack) {
      const played = new Set<TrackId>(session.slice(0, index + 1).map(e => e.trackId));
      const candidates = candidatesFor(c, played);
      const targetRow = candidates.findIndex(cand => cand.track.id === targetId);
      if (targetRow >= 0) {
        // The case's own session must not teach the transition it is testing.
        const heldOut = subtractTransitions(c.transitions, buildTransitions([session]));
        out.push({
          ranks: breakdownsToRankMatrix(computeBreakdowns({ ...c, transitions: heldOut }, seedFor(c, seedTrack), candidates)),
          candidates: candidates.map(cand => ({
            trackId: cand.track.id,
            artistIds: cand.track.artistIds,
            albumId: cand.track.albumId,
          })),
          targetRow,
        });
      }
    }
    if (gen !== generation) return;
    hitProgress.value = { done: i + 1, total: transitions.length };
    if (i % CHUNK === CHUNK - 1) {
      await yieldToUi();
      if (gen !== generation) return;
    }
  }
  transitionCases.value = out;
};

/**
 * Ranks over a source's whole candidate set, so a rating is judged against
 * everything the batch was picked from. Cached per source: the matrix depends
 * on the context and `recentWindow`, never on the labels.
 */
const ratedSourceRanks = (c: RecommenderContext, source: TrackId): SourceRanks | null => {
  if (ratedRanksCtx !== c || ratedRanksWindow !== params.recentWindow) {
    ratedRanksCtx = c;
    ratedRanksWindow = params.recentWindow;
    ratedRanks = new Map();
  }
  const cached = ratedRanks.get(source);
  if (cached) return cached;
  const seedTrack = c.tracks.get(source);
  if (!seedTrack) return null;
  const candidates = candidatesFor(c, excludedFor(c, source));
  const entry: SourceRanks = {
    ranks: breakdownsToRankMatrix(computeBreakdowns(c, seedFor(c, seedTrack), candidates)),
    rowOf: new Map(candidates.map((cand, i) => [cand.track.id, i])),
  };
  ratedRanks.set(source, entry);
  return entry;
};

const agreementCases = computed<AgreementCase[]>(() => {
  const c = ctx.value;
  if (!c) return [];
  const bySource = new Map<TrackId, FeedbackEntry[]>();
  for (const e of feedback.value.values()) {
    if (!c.tracks.has(e.sourceId) || !c.tracks.has(e.candidateId)) continue;
    const list = bySource.get(e.sourceId) ?? [];
    list.push(e);
    bySource.set(e.sourceId, list);
  }
  const out: AgreementCase[] = [];
  for (const [source, entries] of bySource) {
    const sourceRanks = ratedSourceRanks(c, source);
    if (!sourceRanks) continue;
    const likedRows: number[] = [];
    const dislikedRows: number[] = [];
    for (const entry of entries) {
      const row = sourceRanks.rowOf.get(entry.candidateId);
      if (row === undefined) continue;
      if (entry.label === 1) likedRows.push(row);
      else dislikedRows.push(row);
    }
    if (likedRows.length === 0 || dislikedRows.length === 0) continue;
    out.push({ ranks: sourceRanks.ranks, likedRows, dislikedRows });
  }
  return out;
});

export const useRecoStand = () => {
  const playerStore = usePlayerStore();
  const queueStore = useQueueStore();

  const seedTrack = computed(() =>
    seedId.value && ctx.value ? ctx.value.tracks.get(seedId.value) ?? null : null);

  const feedSplit = computed<FeedSplit>(() =>
    splitFeed(queueStore.queue, queueStore.currentIndex, feed.value, feedback.value));
  const feedStarted = computed(() => feed.value.size > 0);
  const feedActive = computed(() => feedSplit.value.current !== null);

  const feedbackCount = computed(() => feedback.value.size);
  const feedbackSources = computed(() => new Set([...feedback.value.values()].map(e => e.sourceId)).size);

  const metrics = computed(() => ({
    hit: hitRate(transitionCases.value, weights, params.limit, mmrOptions()),
    agreement: pairAgreement(agreementCases.value, weights),
  }));

  const refill = () => {
    const c = ctx.value;
    const current = feedSplit.value.current;
    if (!c || !current) return;
    const exclude = new Set<TrackId>(feed.value.keys());
    for (const recent of c.recentlyPlayed.slice(0, Math.max(0, params.recentWindow))) exclude.add(recent);
    const t0 = now();
    const picks = pickFeedBatch({ ...c, now: Date.now() }, current.trackId, exclude, weights, params.limit, mmrOptions());
    timings.value = { ...timings.value, batchMs: now() - t0 };
    if (picks.length === 0) return;
    const next = new Map(feed.value);
    for (const p of picks) next.set(p.track.id, { track: p.track, sourceId: current.trackId, score: p.score, breakdown: p.breakdown });
    feed.value = next;
    queueStore.addMultipleToQueue(picks.map(p => mapTrackEntityToPlayerTrack(p.track)), { type: "autoplay" });
  };

  // Sync so the queue never observes "current is last" between the commit
  // that made it last and the append: otherwise the production autoplay
  // tail watcher would start its own batch.
  watch(() => feedActive.value && queueStore.upcomingItems.length === 0, (due) => {
    if (due) refill();
  }, { flush: "sync" });

  const loadContext = async (dirty: boolean) => {
    isLoading.value = true;
    transitionCases.value = [];
    hitProgress.value = { done: 0, total: 0 };
    const gen = ++generation;
    try {
      if (dirty) markRecommenderContextDirty();
      const t0 = now();
      const [c, fb] = await Promise.all([getRecommenderContext(), loadFeedback()]);
      if (gen !== generation) return;
      timings.value = { contextMs: now() - t0, batchMs: 0 };
      ctx.value = c;
      feedback.value = fb;
      buildTransitionCases(c, gen).catch(error => getLogger().error(`[RecoStand] Building transition cases failed: ${String(error)}`));
    }
    finally {
      isLoading.value = false;
    }
  };

  const load = async () => {
    if (ctx.value || isLoading.value) return;
    await loadContext(false);
  };

  const reload = async () => {
    if (isLoading.value) return;
    await loadContext(true);
  };

  const startFeed = async (id: TrackId) => {
    const track = ctx.value?.tracks.get(id);
    if (!track) return;
    seedId.value = id;
    feed.value = new Map([[id, { track, sourceId: null, score: 0, breakdown: null }]]);
    await queueStore.setQueue([mapTrackEntityToPlayerTrack(track)], 0, { type: "manual" });
  };

  const pickCurrent = () => {
    const id = playerStore.currentTrack?.id;
    if (id && ctx.value?.tracks.has(id as TrackId)) startFeed(id as TrackId).catch(() => {});
  };

  const pickRandomFromHistory = () => {
    const c = ctx.value;
    if (!c) return;
    const pool = c.recentlyPlayed.length > 0 ? c.recentlyPlayed : [...c.tracks.keys()];
    if (pool.length === 0) return;
    // eslint-disable-next-line sonarjs/pseudo-random -- UI sampling only, not security-sensitive
    startFeed(pool[Math.floor(Math.random() * pool.length)]).catch(() => {});
  };

  const searchTracks = (q: string, limit = 20): TrackEntity[] => {
    const c = ctx.value;
    const needle = q.trim().toLowerCase();
    if (!c || !needle) return [];
    const out: TrackEntity[] = [];
    for (const t of c.tracks.values()) {
      if (t.title.toLowerCase().includes(needle) || t.artistName.toLowerCase().includes(needle)) {
        out.push(t);
        if (out.length >= limit) break;
      }
    }
    return out;
  };

  const rate = async (trackId: TrackId, label: FeedbackLabel) => {
    const sourceId = feed.value.get(trackId)?.sourceId;
    if (!sourceId) return;
    const key = pairKey(sourceId, trackId);
    const next = new Map(feedback.value);
    if (next.get(key)?.label === label) next.delete(key);
    else next.set(key, { sourceId, candidateId: trackId, label, at: Date.now() });
    feedback.value = next;
    await saveFeedback(next.values());
  };

  const likeCurrent = async () => {
    const current = feedSplit.value.current;
    if (current) await rate(current.trackId, 1);
  };

  const dislikeCurrent = async () => {
    const current = feedSplit.value.current;
    if (!current) return;
    if (current.label !== -1) await rate(current.trackId, -1);
    await queueStore.next();
  };

  const skipCurrent = () => queueStore.next();

  const jumpTo = async (trackId: TrackId) => {
    const item = queueStore.queue.find(i => i.track.kind === "library" && i.track.id === trackId);
    if (item) await queueStore.jumpToId(item.id);
  };

  // Dropping the upcoming entries from the journal first makes them eligible
  // again for the refill the removal triggers.
  const rebuildUpcoming = async () => {
    const ids = feedSplit.value.upcoming.map(r => r.trackId);
    if (ids.length === 0) {
      refill();
      return;
    }
    const idSet = new Set(ids);
    const next = new Map(feed.value);
    for (const id of ids) next.delete(id);
    feed.value = next;
    const itemIds = queueStore.queue
      .filter(i => i.track.kind === "library" && idSet.has(i.track.id))
      .map(i => i.id);
    await queueStore.removeMultiple(itemIds);
  };

  const resetWeights = () => {
    Object.assign(weights, DEFAULT_WEIGHTS);
    Object.assign(params, DEFAULT_STAND_PARAMS);
  };

  const tune = async () => {
    if (tuneProgress.value) return;
    const tuner = createTuner({
      transitionCases: transitionCases.value,
      agreementCases: agreementCases.value,
      limit: params.limit,
      mmr: mmrOptions(),
    });
    tuneProgress.value = { done: 0, total: tuner.total };
    tuneUsesAgreement.value = tuner.usesAgreement;
    try {
      while (!tuner.step(10)) {
        tuneProgress.value = { done: tuner.done, total: tuner.total };
        await yieldToUi();
      }
      Object.assign(weights, tuner.best.weights);
    }
    finally {
      tuneProgress.value = null;
      tuneUsesAgreement.value = null;
    }
  };

  const copyWeightsJson = async () => {
    const text = JSON.stringify({ weights: { ...weights }, params: { ...params } }, null, 2);
    await navigator.clipboard.writeText(text);
  };

  const exportSnapshot = async (): Promise<string> => {
    const c = ctx.value;
    if (!c) return "";
    const tracks = [...c.tracks.values()].map((t) => {
      const copy: Partial<TrackEntity> = { ...t };
      delete copy.storagePath;
      delete copy.lyricsPath;
      delete copy.fingerprint;
      return copy;
    });
    return writeSnapshot({
      exportedAt: Date.now(),
      tracks,
      sessions: c.sessions,
      feedback: [...feedback.value.values()],
    });
  };

  return {
    ctx, isLoading, seedId, seedTrack, weights, params, timings,
    feedSplit, feedActive, feedStarted,
    feedbackCount, feedbackSources, metrics, hitProgress, tuneProgress, tuneUsesAgreement,
    load, reload, startFeed, pickCurrent, pickRandomFromHistory, searchTracks,
    rate, likeCurrent, dislikeCurrent, skipCurrent, jumpTo, rebuildUpcoming,
    resetWeights, tune, copyWeightsJson, exportSnapshot,
  };
};
