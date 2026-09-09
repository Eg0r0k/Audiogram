import type { ListenPick, TrackEntity } from "@/db/entities";
import type { ArtistId } from "@/types/ids";
import type { AffinityEntry } from "./affinity";
import { mmrSelect, type MmrCandidate, type MmrOptions } from "./rank";
import { artistAffinityOf, type Breakdown } from "./scoring";

export interface SlateCandidate extends MmrCandidate {
  track: TrackEntity;
  breakdown: Breakdown;
}

export interface SlatePick<T> {
  item: T;
  pick: ListenPick;
}

export interface SlateOptions<T extends SlateCandidate> {
  limit: number;
  /** Share of the slate given to exploration, 0..1. */
  exploreShare: number;
  mmr: MmrOptions;
  allowExplore: boolean;
  isExploreEligible: (c: T) => boolean;
  /** Uniform in [0, 1). */
  rng: () => number;
  /** Exploration draws from the best this many eligible candidates. */
  poolTop?: number;
}

export const DEFAULT_EXPLORE_SHARE = 1 / 3;
export const DEFAULT_POOL_TOP = 20;
const RECENTLY_ADDED_MS = 30 * 86_400_000;

export const exploreSlots = (limit: number, share: number): number =>
  Math.max(0, Math.min(limit, Math.round(limit * share)));

/**
 * An unplayed track earns an exploration draw only with a hook: an artist
 * the user already likes, or a recent import. (A like already gives the
 * track an affinity entry, so it never reaches the pool.)
 */
export const exploreEligibility = (
  ctx: { artistAffinity: ReadonlyMap<ArtistId, AffinityEntry> },
  now: number,
  recentAddedMs = RECENTLY_ADDED_MS,
) => (c: SlateCandidate): boolean =>
  artistAffinityOf(ctx.artistAffinity, c.track.artistIds) > 0
  || now - c.track.addedAt <= recentAddedMs;

/**
 * Ranked picks via MMR plus `exploreSlots` draws from the exploration pool,
 * interleaved so an exploration pick never opens the slate and never follows
 * another one while ranked picks remain (Pandora: exploratory songs cost
 * least right after familiar ones).
 */
export const buildSlate = <T extends SlateCandidate>(
  candidates: readonly T[],
  opts: SlateOptions<T>,
): SlatePick<T>[] => {
  const poolTop = opts.poolTop ?? DEFAULT_POOL_TOP;
  const k = opts.allowExplore ? exploreSlots(opts.limit, opts.exploreShare) : 0;

  const explore: T[] = [];
  if (k > 0) {
    const pool = candidates
      .filter(c => c.breakdown.explore === 1 && opts.isExploreEligible(c))
      .sort((a, b) => b.score - a.score)
      .slice(0, poolTop);
    while (explore.length < k && pool.length > 0) {
      const i = Math.min(pool.length - 1, Math.floor(opts.rng() * pool.length));
      explore.push(pool.splice(i, 1)[0]);
    }
  }

  const taken = new Set(explore.map(c => c.trackId));
  const ranked = mmrSelect(candidates.filter(c => !taken.has(c.trackId)), opts.limit - explore.length, opts.mmr);

  const out: SlatePick<T>[] = [];
  let e = 0;
  for (const r of ranked) {
    out.push({ item: r, pick: "rank" });
    if (e < explore.length) out.push({ item: explore[e++], pick: "explore" });
  }
  for (; e < explore.length; e++) out.push({ item: explore[e], pick: "explore" });
  return out;
};
