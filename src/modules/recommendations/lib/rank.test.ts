import { describe, it, expect } from "vitest";
import { percentileRanks, mmrSelect, DEFAULT_MMR_OPTIONS, type MmrCandidate } from "./rank";
import { TrackId, ArtistId, AlbumId } from "@/types/ids";

const makeCandidate = (
  overrides: Partial<MmrCandidate> = {},
): MmrCandidate => ({
  trackId: TrackId("track-default"),
  artistIds: [ArtistId("artist-default")],
  albumId: AlbumId("album-default"),
  score: 1.0,
  ...overrides,
});

describe("rank", () => {
  describe("percentileRanks", () => {
    it("returns empty array for empty input", () => {
      expect(percentileRanks([])).toEqual([]);
    });

    it("returns [0.5] for single element", () => {
      expect(percentileRanks([7])).toEqual([0.5]);
    });

    it("returns correct percentiles for [10, 30, 20]", () => {
      const result = percentileRanks([10, 30, 20]);
      expect(result).toHaveLength(3);
      expect(result[0]).toBeCloseTo(0, 5);
      expect(result[1]).toBeCloseTo(1, 5);
      expect(result[2]).toBeCloseTo(0.5, 5);
    });

    it("handles ties: [5, 5, 5, 9] → [1/3, 1/3, 1/3, 1]", () => {
      const result = percentileRanks([5, 5, 5, 9]);
      expect(result).toHaveLength(4);
      expect(result[0]).toBeCloseTo(1 / 3, 5);
      expect(result[1]).toBeCloseTo(1 / 3, 5);
      expect(result[2]).toBeCloseTo(1 / 3, 5);
      expect(result[3]).toBeCloseTo(1, 5);
    });

    it("preserves order: [5, 9, 7] → [0, 1, 0.5]", () => {
      const result = percentileRanks([5, 9, 7]);
      expect(result[0]).toBeCloseTo(0, 5);
      expect(result[1]).toBeCloseTo(1, 5);
      expect(result[2]).toBeCloseTo(0.5, 5);
    });

    it("handles all equal values: [3, 3, 3] → [0.5, 0.5, 0.5]", () => {
      const result = percentileRanks([3, 3, 3]);
      expect(result).toEqual([0.5, 0.5, 0.5]);
    });
  });

  describe("mmrSelect", () => {
    it("returns empty array when pool is empty", () => {
      const result = mmrSelect([], 5);
      expect(result).toEqual([]);
    });

    it("returns all candidates when limit exceeds pool size", () => {
      const candidates = [
        makeCandidate({ trackId: TrackId("t1") }),
        makeCandidate({ trackId: TrackId("t2") }),
      ];
      const result = mmrSelect(candidates, 10);
      expect(result).toHaveLength(2);
      expect(result.map(c => c.trackId)).toEqual([TrackId("t1"), TrackId("t2")]);
    });

    it("picks highest score first without diversification needed", () => {
      const candidates = [
        makeCandidate({ trackId: TrackId("t1"), score: 0.5 }),
        makeCandidate({ trackId: TrackId("t2"), score: 1.0 }),
        makeCandidate({ trackId: TrackId("t3"), score: 0.7 }),
      ];
      const result = mmrSelect(candidates, 1);
      expect(result).toHaveLength(1);
      expect(result[0].trackId).toBe(TrackId("t2"));
    });

    it("applies artist penalty for same artist: 4 same-artist (1.0) + 1 other (0.9), limit 3", () => {
      const artist1 = ArtistId("a1");
      const artist2 = ArtistId("a2");
      const candidates = [
        makeCandidate({ trackId: TrackId("t1"), artistIds: [artist1], score: 1.0 }),
        makeCandidate({ trackId: TrackId("t2"), artistIds: [artist1], score: 1.0 }),
        makeCandidate({ trackId: TrackId("t3"), artistIds: [artist1], score: 1.0 }),
        makeCandidate({ trackId: TrackId("t4"), artistIds: [artist1], score: 1.0 }),
        makeCandidate({ trackId: TrackId("t5"), artistIds: [artist2], score: 0.9 }),
      ];
      const result = mmrSelect(candidates, 3, DEFAULT_MMR_OPTIONS);
      expect(result).toHaveLength(3);
      expect(result[0].trackId).toBe(TrackId("t1"));
      expect(result[1].artistIds[0]).toBe(artist2);
      expect(result[2].artistIds[0]).toBe(artist1);
    });

    it("respects artist cap: 5 tracks of one artist, limit 3, maxPerArtist 2", () => {
      const artist1 = ArtistId("a1");
      const artist2 = ArtistId("a2");
      const artist3 = ArtistId("a3");
      const candidates = [
        makeCandidate({ trackId: TrackId("t1"), artistIds: [artist1], score: 1.0 }),
        makeCandidate({ trackId: TrackId("t2"), artistIds: [artist1], score: 0.99 }),
        makeCandidate({ trackId: TrackId("t3"), artistIds: [artist1], score: 0.98 }),
        makeCandidate({ trackId: TrackId("t4"), artistIds: [artist1], score: 0.97 }),
        makeCandidate({ trackId: TrackId("t5"), artistIds: [artist1], score: 0.96 }),
      ];
      const opts = { ...DEFAULT_MMR_OPTIONS, maxPerArtist: 2 };
      const result = mmrSelect(candidates, 3, opts);
      expect(result).toHaveLength(3);
      expect(result[0].artistIds[0]).toBe(artist1);
      expect(result[1].artistIds[0]).toBe(artist1);
      expect(result[2].artistIds[0]).toBe(artist1);
      const artist1Count = result.filter(c => c.artistIds[0] === artist1).length;
      expect(artist1Count).toBe(3);
    });

    it("relaxes artist cap when no alternatives remain", () => {
      const artist1 = ArtistId("a1");
      const candidates = [
        makeCandidate({ trackId: TrackId("t1"), artistIds: [artist1], score: 1.0 }),
        makeCandidate({ trackId: TrackId("t2"), artistIds: [artist1], score: 0.99 }),
        makeCandidate({ trackId: TrackId("t3"), artistIds: [artist1], score: 0.98 }),
      ];
      const opts = { ...DEFAULT_MMR_OPTIONS, maxPerArtist: 2 };
      const result = mmrSelect(candidates, 3, opts);
      expect(result).toHaveLength(3);
      expect(result.every(c => c.artistIds[0] === artist1)).toBe(true);
    });

    it("applies album penalty: two tracks same album get penalty", () => {
      const album1 = AlbumId("album-1");
      const album2 = AlbumId("album-2");
      const candidates = [
        makeCandidate({ trackId: TrackId("t1"), albumId: album1, score: 1.0 }),
        makeCandidate({ trackId: TrackId("t2"), albumId: album1, score: 0.99 }),
        makeCandidate({ trackId: TrackId("t3"), albumId: album2, score: 0.98 }),
      ];
      const result = mmrSelect(candidates, 3, DEFAULT_MMR_OPTIONS);
      expect(result).toHaveLength(3);
      expect(result[0].albumId).toBe(album1);
      expect(result[1].albumId).toBe(album2);
      expect(result[2].albumId).toBe(album1);
    });

    it("maxPerArtist = 0 means no cap", () => {
      const artist1 = ArtistId("a1");
      const candidates = [
        makeCandidate({ trackId: TrackId("t1"), artistIds: [artist1], score: 1.0 }),
        makeCandidate({ trackId: TrackId("t2"), artistIds: [artist1], score: 0.99 }),
        makeCandidate({ trackId: TrackId("t3"), artistIds: [artist1], score: 0.98 }),
        makeCandidate({ trackId: TrackId("t4"), artistIds: [artist1], score: 0.97 }),
      ];
      const opts = { ...DEFAULT_MMR_OPTIONS, maxPerArtist: 0 };
      const result = mmrSelect(candidates, 4, opts);
      expect(result).toHaveLength(4);
      expect(result.every(c => c.artistIds[0] === artist1)).toBe(true);
    });

    it("maxPerArtist = -1 means no cap", () => {
      const artist1 = ArtistId("a1");
      const candidates = [
        makeCandidate({ trackId: TrackId("t1"), artistIds: [artist1], score: 1.0 }),
        makeCandidate({ trackId: TrackId("t2"), artistIds: [artist1], score: 0.99 }),
        makeCandidate({ trackId: TrackId("t3"), artistIds: [artist1], score: 0.98 }),
      ];
      const opts = { ...DEFAULT_MMR_OPTIONS, maxPerArtist: -1 };
      const result = mmrSelect(candidates, 3, opts);
      expect(result).toHaveLength(3);
      expect(result.every(c => c.artistIds[0] === artist1)).toBe(true);
    });

    it("uses DEFAULT_MMR_OPTIONS when opts not provided", () => {
      const candidates = [
        makeCandidate({ trackId: TrackId("t1"), score: 1.0 }),
        makeCandidate({ trackId: TrackId("t2"), score: 0.99 }),
      ];
      const result = mmrSelect(candidates, 2);
      expect(result).toHaveLength(2);
      expect(result[0].score).toBe(1.0);
      expect(result[1].score).toBe(0.99);
    });

    it("handles multiple artists per track", () => {
      const artist1 = ArtistId("a1");
      const artist2 = ArtistId("a2");
      const artist3 = ArtistId("a3");
      const candidates = [
        makeCandidate({ trackId: TrackId("t1"), artistIds: [artist1, artist2], score: 1.0 }),
        makeCandidate({ trackId: TrackId("t2"), artistIds: [artist1], score: 0.99 }),
        makeCandidate({ trackId: TrackId("t3"), artistIds: [artist3], score: 0.98 }),
      ];
      const result = mmrSelect(candidates, 3, DEFAULT_MMR_OPTIONS);
      expect(result).toHaveLength(3);
      expect(result[0].trackId).toBe(TrackId("t1"));
    });
  });

  describe("DEFAULT_MMR_OPTIONS", () => {
    it("has correct default values", () => {
      expect(DEFAULT_MMR_OPTIONS.artistPenalty).toBe(0.15);
      expect(DEFAULT_MMR_OPTIONS.albumPenalty).toBe(0.1);
      expect(DEFAULT_MMR_OPTIONS.maxPerArtist).toBe(2);
    });
  });
});
