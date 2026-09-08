import type { ArtistId, TrackId } from "@/types/ids";
import type { Session } from "./sessions";

export interface TransitionOptions {
  /** Max positional distance inside a session that still counts. */
  window: number;
  /** "b was played after a" also relates a to b, weaker. */
  backwardFactor: number;
  /** Autoplay-appended targets are the recommender's own picks — mostly noise. */
  autoplayFactor: number;
  /** A skipped target turns the pair into (mild) negative evidence. */
  skippedTargetFactor: number;
}

export const DEFAULT_TRANSITION_OPTIONS: TransitionOptions = {
  window: 5,
  backwardFactor: 0.5,
  autoplayFactor: 0.3,
  skippedTargetFactor: -0.5,
};

export type TransitionMatrix<K extends string> = Map<K, Map<K, number>>;

export interface Transitions {
  tracks: TransitionMatrix<TrackId>;
  artists: TransitionMatrix<ArtistId>;
}

const add = <K extends string>(m: TransitionMatrix<K>, from: K, to: K, w: number): void => {
  let row = m.get(from);
  if (!row) {
    row = new Map();
    m.set(from, row);
  }
  row.set(to, (row.get(to) ?? 0) + w);
};

export const buildTransitions = (
  sessions: readonly Session[],
  opts: TransitionOptions = DEFAULT_TRANSITION_OPTIONS,
): Transitions => {
  const tracks: TransitionMatrix<TrackId> = new Map();
  const artists: TransitionMatrix<ArtistId> = new Map();

  for (const session of sessions) {
    for (let i = 0; i < session.length; i++) {
      const a = session[i];
      const last = Math.min(session.length - 1, i + opts.window);
      for (let j = i + 1; j <= last; j++) {
        const b = session[j];
        const base = 1 / (j - i);
        const targetFactor = (e: typeof b) =>
          (e.skipped ? opts.skippedTargetFactor : 1) * (e.origin === "autoplay" ? opts.autoplayFactor : 1);

        if (a.trackId !== b.trackId) {
          add(tracks, a.trackId, b.trackId, base * targetFactor(b));
          add(tracks, b.trackId, a.trackId, base * opts.backwardFactor * targetFactor(a));
        }
        if (a.artistId && b.artistId && a.artistId !== b.artistId) {
          add(artists, a.artistId, b.artistId, base * targetFactor(b));
          add(artists, b.artistId, a.artistId, base * opts.backwardFactor * targetFactor(a));
        }
      }
    }
  }
  return { tracks, artists };
};

/** Signed, saturating weight in (−1, 1): a single pairing is ~0.5, a habit tends to 1. */
export const transitionWeight = <K extends string>(m: TransitionMatrix<K>, from: K, to: K): number => {
  const v = m.get(from)?.get(to) ?? 0;
  return v / (1 + Math.abs(v));
};

const subtractMatrix = <K extends string>(base: TransitionMatrix<K>, minus: TransitionMatrix<K>): TransitionMatrix<K> => {
  const result: TransitionMatrix<K> = new Map(base);
  for (const [from, minusRow] of minus) {
    const baseRow = base.get(from);
    const row = new Map(baseRow ?? []);
    for (const [to, v] of minusRow) {
      const next = (row.get(to) ?? 0) - v;
      if (Math.abs(next) < 1e-9) row.delete(to);
      else row.set(to, next);
    }
    if (row.size === 0) result.delete(from);
    else result.set(from, row);
  }
  return result;
};

export const subtractTransitions = (base: Transitions, minus: Transitions): Transitions => ({
  tracks: subtractMatrix(base.tracks, minus.tracks),
  artists: subtractMatrix(base.artists, minus.artists),
});
