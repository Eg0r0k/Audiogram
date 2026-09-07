import { computed, reactive, ref, shallowRef } from "vue";
import type { TrackEntity } from "@/db/entities";
import type { TrackId } from "@/types/ids";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { mapTrackEntityToPlayerTrack } from "@/modules/player/utils/trackEntity";
import { getLogger } from "@/lib/logger";
import { buildRecommendationContext, type RecommendationContext } from "../service/recommendation-context";
import { collectSignalMatrix, type SignalMatrix, type Weights } from "../service/signals";
import { DEFAULT_PARAMS, DEFAULT_WEIGHTS, scoreMatrix, selectTop, toScoredTracks, type ScoredTrack, type ScoringParams } from "../service/scoring";
import { candidateIdsFor } from "../service/recommender.service";
import { loadFeedback, pairKey, saveFeedback, writeSnapshot, type FeedbackEntry, type FeedbackLabel } from "../service/stand-feedback.store";
import { hitRate, pairAgreement, sampleTransitions, type AgreementCase, type TransitionCase } from "../service/stand-metrics";
import { createTuner } from "../service/stand-tuner";

export interface StandTimings { contextMs: number; signalsMs: number; scoringMs: number }
export interface StandRow extends ScoredTrack { label: FeedbackLabel | null }

const HIT_SAMPLE = 200;
const HIT_SEED = 42;
const CHUNK = 10;

const ctx = shallowRef<RecommendationContext | null>(null);
const isLoading = ref(false);
const sourceId = ref<TrackId | null>(null);
const weights = reactive<Weights>({ ...DEFAULT_WEIGHTS });
const params = reactive<ScoringParams>({ ...DEFAULT_PARAMS });
const extraRows = ref(0);
const timings = ref<StandTimings>({ contextMs: 0, signalsMs: 0, scoringMs: 0 });
const feedback = ref<Map<string, FeedbackEntry>>(new Map());
const sourceMatrix = shallowRef<SignalMatrix | null>(null);
const transitionCases = shallowRef<TransitionCase[]>([]);
const hitProgress = ref({ done: 0, total: 0 });
const tuneProgress = ref<{ done: number; total: number } | null>(null);

const yieldToUi = () => new Promise<void>(resolve => setTimeout(resolve, 0));

const now = () => performance.now();

const rebuildSourceMatrix = () => {
  const c = ctx.value;
  const id = sourceId.value;
  if (!c || !id) {
    sourceMatrix.value = null;
    return;
  }
  const t0 = now();
  const candidates = candidateIdsFor(id, c, params.recentWindow, []);
  sourceMatrix.value = collectSignalMatrix(id, candidates, c);
  timings.value = { ...timings.value, signalsMs: now() - t0 };
};

const buildTransitionCases = async (c: RecommendationContext) => {
  const transitions = sampleTransitions(c.trackSessions, HIT_SAMPLE, HIT_SEED);
  hitProgress.value = { done: 0, total: transitions.length };
  const out: TransitionCase[] = [];
  for (let i = 0; i < transitions.length; i++) {
    const { session, index } = transitions[i];
    const source = session[index];
    const target = session[index + 1];
    const played = new Set(session.slice(0, index + 1));
    const candidates = candidateIdsFor(source, c, 0, played);
    const sessionTracks = new Set(session);
    const artists = new Set(session.flatMap(t => c.tracks.get(t)?.artistIds ?? []));
    const matrix = collectSignalMatrix(source, candidates, c, { exclude: { tracks: sessionTracks, artists } });
    out.push({ matrix, targetRow: matrix.candidateIds.indexOf(target) });
    hitProgress.value = { done: i + 1, total: transitions.length };
    if (i % CHUNK === CHUNK - 1) await yieldToUi();
  }
  transitionCases.value = out;
};

const agreementCases = (): AgreementCase[] => {
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
    const matrix = collectSignalMatrix(source, entries.map(e => e.candidateId), c);
    const likedRows: number[] = [];
    const dislikedRows: number[] = [];
    matrix.candidateIds.forEach((id, row) => {
      const label = entries.find(e => e.candidateId === id)?.label;
      if (label === 1) likedRows.push(row);
      else if (label === -1) dislikedRows.push(row);
    });
    out.push({ matrix, likedRows, dislikedRows });
  }
  return out;
};

export const useRecoStand = () => {
  const playerStore = usePlayerStore();
  const queueStore = useQueueStore();

  const sourceTrack = computed(() =>
    sourceId.value && ctx.value ? ctx.value.tracks.get(sourceId.value) ?? null : null);

  const rows = computed<StandRow[]>(() => {
    const c = ctx.value;
    const m = sourceMatrix.value;
    const id = sourceId.value;
    if (!c || !m || !id) return [];
    const t0 = now();
    const scores = scoreMatrix(m, weights);
    const top = selectTop(m, scores, params.limit + extraRows.value, params.maxPerArtist);
    const scored = toScoredTracks(m, scores, top, c.tracks);
    timings.value = { ...timings.value, scoringMs: now() - t0 };
    return scored.map(r => ({ ...r, label: feedback.value.get(pairKey(id, r.trackId))?.label ?? null }));
  });

  const feedbackCount = computed(() => feedback.value.size);
  const feedbackSources = computed(() => new Set([...feedback.value.values()].map(e => e.sourceId)).size);

  const metrics = computed(() => {
    const hit = hitRate(transitionCases.value, weights, params.limit, params.maxPerArtist);
    const agreement = pairAgreement(agreementCases(), weights);
    return { hit, agreement };
  });

  const load = async () => {
    if (ctx.value || isLoading.value) return;
    await reload();
  };

  const reload = async () => {
    isLoading.value = true;
    try {
      const t0 = now();
      const [c, fb] = await Promise.all([buildRecommendationContext(), loadFeedback()]);
      timings.value = { contextMs: now() - t0, signalsMs: 0, scoringMs: 0 };
      ctx.value = c;
      feedback.value = fb;
      rebuildSourceMatrix();
      buildTransitionCases(c).catch(error => getLogger().error(`[RecoStand] Building transition cases failed: ${String(error)}`));
    }
    finally {
      isLoading.value = false;
    }
  };

  const setSource = (id: TrackId | null) => {
    sourceId.value = id;
    extraRows.value = 0;
    rebuildSourceMatrix();
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
    Object.assign(params, DEFAULT_PARAMS);
  };

  const tune = async () => {
    if (tuneProgress.value) return;
    const tuner = createTuner({
      transitionCases: transitionCases.value,
      agreementCases: agreementCases(),
      limit: params.limit,
      maxPerArtist: params.maxPerArtist,
      frozen: { audioSimilarity: 0 },
    });
    tuneProgress.value = { done: 0, total: tuner.total };
    try {
      while (!tuner.step(25)) {
        tuneProgress.value = { done: tuner.done, total: tuner.total };
        await yieldToUi();
      }
      Object.assign(weights, tuner.best.weights);
    }
    finally {
      tuneProgress.value = null;
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
      sessions: c.trackSessions,
      feedback: [...feedback.value.values()],
    });
  };

  return {
    ctx, isLoading, sourceId, sourceTrack, weights, params, extraRows, rows, timings,
    feedbackCount, feedbackSources, metrics, hitProgress, tuneProgress,
    load, reload, setSource, pickCurrent, pickRandomFromHistory, searchTracks,
    rate, play, resetWeights, tune, copyWeightsJson, exportSnapshot,
  };
};
