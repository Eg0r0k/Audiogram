import { computed, reactive, ref, shallowRef, watch } from "vue";
import type { TrackEntity } from "@/db/entities";
import { getLogger } from "@/lib/logger";
import { mapTrackEntityToPlayerTrack } from "@/modules/player/utils/trackEntity";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import type { TrackId } from "@/types/ids";
import { DEFAULT_MMR_OPTIONS, mmrSelect, type MmrOptions } from "../lib/rank";
import {
  computeBreakdowns,
  DEFAULT_WEIGHTS,
  scoreBreakdown,
  type Breakdown,
  type CandidateInput,
  type ComponentWeights,
  type SeedInput,
} from "../lib/scoring";
import { buildTransitions, subtractTransitions } from "../lib/transitions";
import { getRecommenderContext, markRecommenderContextDirty, type RecommenderContext } from "../service/recommender-context.service";
import { RECENT_EXCLUDE, type ScoredTrack } from "../service/recommender.service";
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

export const DEFAULT_STAND_PARAMS: StandParams = {
  limit: 8,
  recentWindow: RECENT_EXCLUDE,
  maxPerArtist: DEFAULT_MMR_OPTIONS.maxPerArtist,
  artistPenalty: DEFAULT_MMR_OPTIONS.artistPenalty,
  albumPenalty: DEFAULT_MMR_OPTIONS.albumPenalty,
};

export interface StandTimings { contextMs: number; componentsMs: number; scoringMs: number }
export interface StandRow extends ScoredTrack { label: FeedbackLabel | null }

interface SourceComponents {
  candidates: CandidateInput[];
  breakdowns: Breakdown[];
}

const HIT_SAMPLE = 200;
const HIT_SEED = 42;
const CHUNK = 10;

const ctx = shallowRef<RecommenderContext | null>(null);
const isLoading = ref(false);
const sourceId = ref<TrackId | null>(null);
const weights = reactive<ComponentWeights>({ ...DEFAULT_WEIGHTS });
const params = reactive<StandParams>({ ...DEFAULT_STAND_PARAMS });
const extraRows = ref(0);
const timings = ref<StandTimings>({ contextMs: 0, componentsMs: 0, scoringMs: 0 });
const feedback = ref<Map<string, FeedbackEntry>>(new Map());
const sourceComponents = shallowRef<SourceComponents | null>(null);
const transitionCases = shallowRef<TransitionCase[]>([]);
const hitProgress = ref({ done: 0, total: 0 });
const tuneProgress = ref<{ done: number; total: number } | null>(null);
const tuneUsesAgreement = ref<boolean | null>(null);

const yieldToUi = () => new Promise<void>(resolve => setTimeout(resolve, 0));

const now = () => performance.now();

const mmrOptions = (): MmrOptions => ({
  artistPenalty: params.artistPenalty,
  albumPenalty: params.albumPenalty,
  maxPerArtist: params.maxPerArtist,
});

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

/** Weight-independent part of the scoring: recomputed only on source / recentWindow change. */
const rebuildSourceComponents = () => {
  const c = ctx.value;
  const id = sourceId.value;
  const seedTrack = c && id ? c.tracks.get(id) : undefined;
  if (!c || !seedTrack) {
    sourceComponents.value = null;
    return;
  }
  const t0 = now();
  const excluded = new Set<TrackId>([seedTrack.id]);
  for (const recent of c.recentlyPlayed.slice(0, Math.max(0, params.recentWindow))) excluded.add(recent);
  const candidates = candidatesFor(c, excluded);
  sourceComponents.value = { candidates, breakdowns: computeBreakdowns(c, seedFor(c, seedTrack), candidates) };
  timings.value = { ...timings.value, componentsMs: now() - t0 };
};

watch(() => params.recentWindow, rebuildSourceComponents);

const buildTransitionCases = async (c: RecommenderContext) => {
  const transitions = sampleTransitions(c.sessions, HIT_SAMPLE, HIT_SEED);
  if (ctx.value !== c) return;
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
          breakdowns: computeBreakdowns({ ...c, transitions: heldOut }, seedFor(c, seedTrack), candidates),
          candidates: candidates.map(cand => ({
            trackId: cand.track.id,
            artistIds: cand.track.artistIds,
            albumId: cand.track.albumId,
          })),
          targetRow,
        });
      }
    }
    if (ctx.value !== c) return;
    hitProgress.value = { done: i + 1, total: transitions.length };
    if (i % CHUNK === CHUNK - 1) {
      await yieldToUi();
      if (ctx.value !== c) return;
    }
  }
  if (ctx.value !== c) return;
  transitionCases.value = out;
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
    const seedTrack = c.tracks.get(source);
    if (!seedTrack) continue;
    const candidates: CandidateInput[] = [];
    const likedRows: number[] = [];
    const dislikedRows: number[] = [];
    for (const entry of entries) {
      const track = c.tracks.get(entry.candidateId);
      if (!track) continue;
      if (entry.label === 1) likedRows.push(candidates.length);
      else dislikedRows.push(candidates.length);
      candidates.push({ track, features: c.features.get(track.id) ?? null });
    }
    out.push({
      breakdowns: computeBreakdowns(c, seedFor(c, seedTrack), candidates),
      likedRows,
      dislikedRows,
    });
  }
  return out;
});

export const useRecoStand = () => {
  const playerStore = usePlayerStore();
  const queueStore = useQueueStore();

  const sourceTrack = computed(() =>
    sourceId.value && ctx.value ? ctx.value.tracks.get(sourceId.value) ?? null : null);

  const rows = computed<StandRow[]>(() => {
    const s = sourceComponents.value;
    const id = sourceId.value;
    if (!s || !id) return [];
    const t0 = now();
    const scored = s.candidates.map((cand, i) => ({
      trackId: cand.track.id,
      artistIds: cand.track.artistIds,
      albumId: cand.track.albumId,
      score: scoreBreakdown(s.breakdowns[i], weights),
      track: cand.track,
      breakdown: s.breakdowns[i],
    }));
    const picked = mmrSelect(scored, params.limit + extraRows.value, mmrOptions());
    timings.value = { ...timings.value, scoringMs: now() - t0 };
    return picked.map(p => ({
      trackId: p.trackId,
      track: p.track,
      score: p.score,
      breakdown: p.breakdown,
      label: feedback.value.get(pairKey(id, p.trackId))?.label ?? null,
    }));
  });

  const feedbackCount = computed(() => feedback.value.size);
  const feedbackSources = computed(() => new Set([...feedback.value.values()].map(e => e.sourceId)).size);
  const candidateCount = computed(() => sourceComponents.value?.candidates.length ?? null);

  const metrics = computed(() => ({
    hit: hitRate(transitionCases.value, weights, params.limit, mmrOptions()),
    agreement: pairAgreement(agreementCases.value, weights),
  }));

  const loadContext = async (dirty: boolean) => {
    isLoading.value = true;
    transitionCases.value = [];
    hitProgress.value = { done: 0, total: 0 };
    try {
      if (dirty) markRecommenderContextDirty();
      const t0 = now();
      const [c, fb] = await Promise.all([getRecommenderContext(), loadFeedback()]);
      timings.value = { contextMs: now() - t0, componentsMs: 0, scoringMs: 0 };
      ctx.value = c;
      feedback.value = fb;
      rebuildSourceComponents();
      buildTransitionCases(c).catch(error => getLogger().error(`[RecoStand] Building transition cases failed: ${String(error)}`));
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

  const setSource = (id: TrackId | null) => {
    sourceId.value = id;
    extraRows.value = 0;
    rebuildSourceComponents();
  };

  const pickCurrent = () => {
    const id = playerStore.currentTrack?.id;
    if (id && ctx.value?.tracks.has(id as TrackId)) setSource(id as TrackId);
  };

  const pickRandomFromHistory = () => {
    const c = ctx.value;
    if (!c) return;
    const pool = c.recentlyPlayed.length > 0 ? c.recentlyPlayed : [...c.tracks.keys()];
    if (pool.length === 0) return;
    // eslint-disable-next-line sonarjs/pseudo-random -- UI sampling only, not security-sensitive
    setSource(pool[Math.floor(Math.random() * pool.length)]);
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

  const rate = async (candidateId: TrackId, label: FeedbackLabel) => {
    const id = sourceId.value;
    if (!id) return;
    const key = pairKey(id, candidateId);
    const next = new Map(feedback.value);
    if (next.get(key)?.label === label) next.delete(key);
    else next.set(key, { sourceId: id, candidateId, label, at: Date.now() });
    feedback.value = next;
    await saveFeedback(next.values());
  };

  const play = async (track: TrackEntity) => {
    await queueStore.setQueue([mapTrackEntityToPlayerTrack(track)], 0, { type: "manual" });
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
    ctx, isLoading, sourceId, sourceTrack, weights, params, extraRows, rows, timings,
    feedbackCount, feedbackSources, metrics, hitProgress, tuneProgress, tuneUsesAgreement, candidateCount,
    load, reload, setSource, pickCurrent, pickRandomFromHistory, searchTracks,
    rate, play, resetWeights, tune, copyWeightsJson, exportSnapshot,
  };
};
