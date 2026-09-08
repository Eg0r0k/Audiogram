import { describe, it, expect } from "vitest";
import type { AudioFeaturesEntity } from "@/db/entities";
import {
  computeFeatureStats,
  createAudioSpace,
  type AudioVector,
  type FeatureStats,
} from "./audio-similarity";

const makeFeatures = (
  overrides: Partial<AudioFeaturesEntity> = {},
): AudioFeaturesEntity => ({
  trackId: "track-default" as any,
  bpm: 100,
  energy: 0.5,
  spectralCentroid: 2000,
  danceability: 0.6,
  key: 0,
  mode: 1,
  analyzedAt: Date.now(),
  algorithmVersion: 1,
  ...overrides,
});

describe("audio-similarity", () => {
  describe("computeFeatureStats", () => {
    it("returns null for empty array", () => {
      expect(computeFeatureStats([])).toBeNull();
    });

    it("returns null for single track", () => {
      const track = makeFeatures();
      expect(computeFeatureStats([track])).toBeNull();
    });

    it("computes stats on two tracks with different tempos", () => {
      const tracks = [
        makeFeatures({ trackId: "track-1" as any, bpm: 100 }),
        makeFeatures({ trackId: "track-2" as any, bpm: 200 }),
      ];
      const stats = computeFeatureStats(tracks);
      expect(stats).not.toBeNull();
      expect(stats!.tempo.mean).toBeCloseTo(Math.log2(100) + 0.5, 5);
    });

    it("handles zero std by clamping to 1", () => {
      const tracks = [
        makeFeatures({
          trackId: "track-1" as any,
          danceability: 0.5,
        }),
        makeFeatures({
          trackId: "track-2" as any,
          danceability: 0.5,
        }),
      ];
      const stats = computeFeatureStats(tracks);
      expect(stats).not.toBeNull();
      expect(stats!.danceability.std).toBe(1);
    });
  });

  describe("AudioSpace.encode and distance", () => {
    const fixtures = [
      makeFeatures({
        trackId: "track-1" as any,
        bpm: 80,
        energy: 0.4,
        spectralCentroid: 2000,
        danceability: 0.6,
        key: 0,
        mode: 1,
      }),
      makeFeatures({
        trackId: "track-2" as any,
        bpm: 120,
        energy: 0.6,
        spectralCentroid: 3000,
        danceability: 0.7,
        key: 7,
        mode: 0,
      }),
      makeFeatures({
        trackId: "track-3" as any,
        bpm: 100,
        energy: 0.5,
        spectralCentroid: 2500,
        danceability: 0.65,
        key: 3,
        mode: 1,
      }),
      makeFeatures({
        trackId: "track-4" as any,
        bpm: 90,
        energy: 0.45,
        spectralCentroid: 2100,
        danceability: 0.62,
        key: 1,
        mode: 0,
      }),
    ];

    const stats = computeFeatureStats(fixtures)!;
    const space = createAudioSpace(stats);

    it("encodes a track to AudioVector", () => {
      const vector = space.encode(fixtures[0]);
      expect(vector).toHaveProperty("tempoLog2");
      expect(vector).toHaveProperty("energy");
      expect(vector).toHaveProperty("centroid");
      expect(vector).toHaveProperty("danceability");
      expect(vector).toHaveProperty("mode");
      expect(vector).toHaveProperty("fifths");
    });

    it("returns distance 0 for the same track", () => {
      const v1 = space.encode(fixtures[0]);
      const v2 = space.encode(fixtures[0]);
      expect(space.distance(v1, v2)).toBeCloseTo(0, 10);
    });

    it("returns similarity 1 for the same track", () => {
      const v1 = space.encode(fixtures[0]);
      const v2 = space.encode(fixtures[0]);
      expect(space.similarity(v1, v2)).toBeCloseTo(1, 10);
    });

    it("octave folding: 80 vs 160 bpm distance < 0.05", () => {
      const track1 = makeFeatures({
        trackId: "track-octave-1" as any,
        bpm: 80,
      });
      const track2 = makeFeatures({
        trackId: "track-octave-2" as any,
        bpm: 160,
      });

      const twoTrackStats = computeFeatureStats([track1, track2])!;
      const twoTrackSpace = createAudioSpace(twoTrackStats);
      const v1 = twoTrackSpace.encode(track1);
      const v2 = twoTrackSpace.encode(track2);
      expect(twoTrackSpace.distance(v1, v2)).toBeLessThan(0.05);
    });

    it("octave folding: 80 vs 113 (half-octave) distance noticeably larger than 80 vs 160", () => {
      const track80 = makeFeatures({ trackId: "track-80" as any, bpm: 80 });
      const track160 = makeFeatures({
        trackId: "track-160" as any,
        bpm: 160,
      });
      const track113 = makeFeatures({
        trackId: "track-113" as any,
        bpm: 113,
      });

      const threeTrackStats = computeFeatureStats([track80, track160, track113])!;
      const threeTrackSpace = createAudioSpace(threeTrackStats);

      const v80 = threeTrackSpace.encode(track80);
      const v160 = threeTrackSpace.encode(track160);
      const v113 = threeTrackSpace.encode(track113);

      const octaveDistance = threeTrackSpace.distance(v80, v160);
      const halfOctaveDistance = threeTrackSpace.distance(v80, v113);

      expect(octaveDistance).toBeLessThan(0.05);
      expect(halfOctaveDistance).toBeGreaterThan(octaveDistance + 0.3);
    });

    it("circle of fifths: C(0) vs G(7) closer than C vs F#(6)", () => {
      const baseTrack = makeFeatures({ trackId: "base" as any });
      const trackG = makeFeatures({ trackId: "g" as any, key: 7 });
      const trackFSharp = makeFeatures({ trackId: "fsharp" as any, key: 6 });

      const threeTrackStats = computeFeatureStats([
        baseTrack,
        trackG,
        trackFSharp,
      ])!;
      const threeTrackSpace = createAudioSpace(threeTrackStats);

      const vBase = threeTrackSpace.encode(baseTrack);
      const vG = threeTrackSpace.encode(trackG);
      const vFSharp = threeTrackSpace.encode(trackFSharp);

      const distanceCG = threeTrackSpace.distance(vBase, vG);
      const distanceCFSharp = threeTrackSpace.distance(vBase, vFSharp);

      expect(distanceCG).toBeLessThan(distanceCFSharp);
    });

    it("circle of fifths: C(0) vs B(11) closer than C vs F#(6)", () => {
      const baseTrack = makeFeatures({ trackId: "base" as any });
      const trackB = makeFeatures({ trackId: "b" as any, key: 11 });
      const trackFSharp = makeFeatures({ trackId: "fsharp" as any, key: 6 });

      const threeTrackStats = computeFeatureStats([
        baseTrack,
        trackB,
        trackFSharp,
      ])!;
      const threeTrackSpace = createAudioSpace(threeTrackStats);

      const vBase = threeTrackSpace.encode(baseTrack);
      const vB = threeTrackSpace.encode(trackB);
      const vFSharp = threeTrackSpace.encode(trackFSharp);

      const distanceCB = threeTrackSpace.distance(vBase, vB);
      const distanceCFSharp = threeTrackSpace.distance(vBase, vFSharp);

      expect(distanceCB).toBeLessThan(distanceCFSharp);
    });

    it("mode difference only: distance = sqrt(0.3)", () => {
      const track1 = makeFeatures({
        trackId: "track-mode-1" as any,
        mode: 1,
      });
      const track2 = makeFeatures({
        trackId: "track-mode-2" as any,
        mode: 0,
      });

      const twoTrackStats = computeFeatureStats([track1, track2])!;
      const twoTrackSpace = createAudioSpace(twoTrackStats);
      const v1 = twoTrackSpace.encode(track1);
      const v2 = twoTrackSpace.encode(track2);

      expect(twoTrackSpace.distance(v1, v2)).toBeCloseTo(Math.sqrt(0.3), 5);
    });

    it("distance matches similarity formula: similarity = 1 / (1 + distance)", () => {
      const v1 = space.encode(fixtures[0]);
      const v2 = space.encode(fixtures[1]);
      const dist = space.distance(v1, v2);
      const sim = space.similarity(v1, v2);
      expect(sim).toBeCloseTo(1 / (1 + dist), 10);
    });
  });
});
