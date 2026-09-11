import { describe, expect, it } from "vitest";
import type { TrackEntity } from "@/db/entities";
import type { ArtistId, TrackId } from "@/types/ids";
import { makeLcg } from "./random";
import { DEFAULT_MMR_OPTIONS } from "./rank";
import type { Breakdown } from "./scoring";
import { buildSlate, exploreEligibility, exploreSlots, type SlateCandidate } from "./slate";

const tid = (s: string) => s as TrackId;
const aid = (s: string) => s as ArtistId;

const makeTrack = (id: string, o: Partial<TrackEntity> = {}): TrackEntity => ({
  id: tid(id), title: id, artistName: "Artist", albumTitle: "Album",
  artistIds: [aid(`ar-${id}`)], albumId: `al-${id}` as any, tagIds: [],
  source: "local_internal" as any, pinned: 1, state: 0, duration: 200, format: {},
  playCount: 0, addedAt: 0, ...o,
});

const bd = (explore: 0 | 1): Breakdown => ({
  audioSimilarity: null, trackTransition: 0, artistTransition: 0, affinity: 0, explore, recencyPenalty: 0,
  ranks: { audio: 0, trackTransition: 0, artistTransition: 0, affinity: 0, explore },
});

const cand = (id: string, score: number, explore: 0 | 1 = 0, o: Partial<TrackEntity> = {}): SlateCandidate => {
  const track = makeTrack(id, o);
  return { trackId: track.id, artistIds: track.artistIds, albumId: track.albumId, score, track, breakdown: bd(explore) };
};

const NO_MMR = { artistPenalty: 0, albumPenalty: 0, maxPerArtist: 0 };
const always = () => true;

const base = (over: Partial<Parameters<typeof buildSlate>[1]> = {}) => ({
  limit: 3,
  exploreShare: 1 / 3,
  mmr: NO_MMR,
  allowExplore: true,
  isExploreEligible: always,
  rng: makeLcg(1),
  ...over,
});

describe("exploreSlots", () => {
  it("rounds limit × share and stays within [0, limit]", () => {
    expect(exploreSlots(3, 1 / 3)).toBe(1);
    expect(exploreSlots(5, 0.4)).toBe(2);
    expect(exploreSlots(1, 1 / 3)).toBe(0);
    expect(exploreSlots(3, 0)).toBe(0);
    expect(exploreSlots(3, 5)).toBe(3);
  });
});

describe("buildSlate", () => {
  const ranked = [cand("r1", 0.9), cand("r2", 0.8), cand("r3", 0.7), cand("r4", 0.6)];
  const explorers = [cand("e1", 0.3, 1), cand("e2", 0.2, 1)];

  it("puts the exploration pick between ranked picks for limit 3", () => {
    const slate = buildSlate([...ranked, ...explorers], base());
    expect(slate.map(s => s.pick)).toEqual(["rank", "explore", "rank"]);
    expect(slate[0].item.trackId).toBe(tid("r1"));
    expect(slate[2].item.trackId).toBe(tid("r2"));
    expect(["e1", "e2"]).toContain(slate[1].item.trackId);
  });

  it("interleaves two exploration picks for limit 5, share 0.4", () => {
    const slate = buildSlate([...ranked, ...explorers], base({ limit: 5, exploreShare: 0.4 }));
    expect(slate.map(s => s.pick)).toEqual(["rank", "explore", "rank", "explore", "rank"]);
  });

  it("is all ranked when exploration is not allowed", () => {
    const slate = buildSlate([...ranked, ...explorers], base({ allowExplore: false }));
    expect(slate.map(s => s.pick)).toEqual(["rank", "rank", "rank"]);
    expect(slate.map(s => s.item.trackId)).toEqual([tid("r1"), tid("r2"), tid("r3")]);
  });

  it("fills from the ranking when the pool is empty", () => {
    const slate = buildSlate(ranked, base());
    expect(slate.map(s => s.pick)).toEqual(["rank", "rank", "rank"]);
  });

  it("never draws a played track (explore 0) or an ineligible one", () => {
    const slate = buildSlate([...ranked, cand("e1", 0.3, 1), cand("e2", 0.2, 1)], base({ isExploreEligible: c => c.trackId === tid("e2") }));
    expect(slate[1]).toMatchObject({ pick: "explore", item: { trackId: tid("e2") } });
  });

  it("draws only from the top of the pool", () => {
    const pool = Array.from({ length: 30 }, (_, i) => cand(`e${i}`, 1 - i / 100, 1));
    for (let seed = 0; seed < 20; seed++) {
      const slate = buildSlate([...ranked, ...pool], base({ rng: makeLcg(seed), poolTop: 5 }));
      const pick = slate.find(s => s.pick === "explore")!.item.trackId;
      expect(["e0", "e1", "e2", "e3", "e4"].map(tid)).toContain(pick);
    }
  });

  it("is deterministic for the same rng seed and never repeats a track", () => {
    const all = [...ranked, ...explorers];
    const a = buildSlate(all, base({ rng: makeLcg(7) })).map(s => s.item.trackId);
    const b = buildSlate(all, base({ rng: makeLcg(7) })).map(s => s.item.trackId);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });

  it("appends leftover exploration picks when ranked picks run out", () => {
    const slate = buildSlate([cand("r1", 0.9), ...explorers], base({ limit: 3, exploreShare: 2 / 3 }));
    expect(slate.map(s => s.pick)).toEqual(["rank", "explore", "explore"]);
  });
});

describe("exploreEligibility", () => {
  const now = 1_000_000_000_000;
  const artistAffinity = new Map([[aid("ar-loved"), { score: 0.4, evidence: 5, plays: 5, skips: 0 }]]);
  const eligible = exploreEligibility({ artistAffinity }, now);

  it("accepts a loved artist or a recent import; rejects the rest", () => {
    expect(eligible(cand("a", 0, 1, { artistIds: [aid("ar-loved")] }))).toBe(true);
    expect(eligible(cand("c", 0, 1, { addedAt: now - 86_400_000 }))).toBe(true);
    expect(eligible(cand("d", 0, 1, { addedAt: now - 40 * 86_400_000 }))).toBe(false);
  });

  it("rejects an artist with a negative score", () => {
    const disliked = new Map([[aid("ar-x"), { score: -0.2, evidence: 5, plays: 0, skips: 5 }]]);
    expect(exploreEligibility({ artistAffinity: disliked }, now)(cand("a", 0, 1, { artistIds: [aid("ar-x")] }))).toBe(false);
  });
});

describe("mmr options pass through", () => {
  it("respects maxPerArtist among ranked picks", () => {
    const sameArtist = ["a", "b", "c"].map((id, i) => cand(id, 0.9 - i / 10, 0, { artistIds: [aid("ar-same")] }));
    const other = cand("d", 0.1);
    const slate = buildSlate([...sameArtist, other], base({ allowExplore: false, mmr: { ...DEFAULT_MMR_OPTIONS, maxPerArtist: 2 } }));
    expect(slate.map(s => s.item.trackId)).toEqual([tid("a"), tid("b"), tid("d")]);
  });
});
