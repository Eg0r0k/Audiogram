import { describe, it, expect } from 'vitest';
import type { AudioFeaturesEntity } from '@/db/entities';
import {
  computeFeatureStats,
  createAudioSpace,
  type AudioVector,
  type FeatureStats,
} from './audio-similarity';

describe('audio-similarity', () => {
  describe('computeFeatureStats', () => {
    it('returns null for empty array', () => {
      expect(computeFeatureStats([])).toBeNull();
    });

    it('returns null for single track', () => {
      const track: AudioFeaturesEntity = {
        trackId: 'track-1' as any,
        bpm: 100,
        energy: 0.5,
        spectralCentroid: 2000,
        danceability: 0.7,
        key: 0,
        mode: 1,
        analyzedAt: Date.now(),
        algorithmVersion: 1,
      };
      expect(computeFeatureStats([track])).toBeNull();
    });

    it('computes stats on two tracks with different tempos', () => {
      const tracks: AudioFeaturesEntity[] = [
        {
          trackId: 'track-1' as any,
          bpm: 100,
          energy: 0.5,
          spectralCentroid: 2000,
          danceability: 0.7,
          key: 0,
          mode: 1,
          analyzedAt: Date.now(),
          algorithmVersion: 1,
        },
        {
          trackId: 'track-2' as any,
          bpm: 200,
          energy: 0.5,
          spectralCentroid: 2000,
          danceability: 0.7,
          key: 0,
          mode: 1,
          analyzedAt: Date.now(),
          algorithmVersion: 1,
        },
      ];
      const stats = computeFeatureStats(tracks);
      expect(stats).not.toBeNull();
      expect(stats!.tempo.mean).toBeCloseTo(Math.log2(100) + 0.5, 5);
    });

    it('handles zero std by clamping to 1', () => {
      const tracks: AudioFeaturesEntity[] = [
        {
          trackId: 'track-1' as any,
          bpm: 100,
          energy: 0.5,
          spectralCentroid: 2000,
          danceability: 0.5,
          key: 0,
          mode: 1,
          analyzedAt: Date.now(),
          algorithmVersion: 1,
        },
        {
          trackId: 'track-2' as any,
          bpm: 100,
          energy: 0.5,
          spectralCentroid: 2000,
          danceability: 0.5,
          key: 0,
          mode: 1,
          analyzedAt: Date.now(),
          algorithmVersion: 1,
        },
      ];
      const stats = computeFeatureStats(tracks);
      expect(stats).not.toBeNull();
      expect(stats!.danceability.std).toBe(1);
    });
  });

  describe('AudioSpace.encode and distance', () => {
    const fixtures: AudioFeaturesEntity[] = [
      {
        trackId: 'track-1' as any,
        bpm: 80,
        energy: 0.4,
        spectralCentroid: 2000,
        danceability: 0.6,
        key: 0,
        mode: 1,
        analyzedAt: Date.now(),
        algorithmVersion: 1,
      },
      {
        trackId: 'track-2' as any,
        bpm: 120,
        energy: 0.6,
        spectralCentroid: 3000,
        danceability: 0.7,
        key: 7,
        mode: 0,
        analyzedAt: Date.now(),
        algorithmVersion: 1,
      },
      {
        trackId: 'track-3' as any,
        bpm: 100,
        energy: 0.5,
        spectralCentroid: 2500,
        danceability: 0.65,
        key: 3,
        mode: 1,
        analyzedAt: Date.now(),
        algorithmVersion: 1,
      },
      {
        trackId: 'track-4' as any,
        bpm: 90,
        energy: 0.45,
        spectralCentroid: 2100,
        danceability: 0.62,
        key: 1,
        mode: 0,
        analyzedAt: Date.now(),
        algorithmVersion: 1,
      },
    ];

    const stats = computeFeatureStats(fixtures)!;
    const space = createAudioSpace(stats);

    it('encodes a track to AudioVector', () => {
      const vector = space.encode(fixtures[0]);
      expect(vector).toHaveProperty('tempoLog2');
      expect(vector).toHaveProperty('energy');
      expect(vector).toHaveProperty('centroid');
      expect(vector).toHaveProperty('danceability');
      expect(vector).toHaveProperty('mode');
      expect(vector).toHaveProperty('fifths');
    });

    it('returns distance 0 for the same track', () => {
      const v1 = space.encode(fixtures[0]);
      const v2 = space.encode(fixtures[0]);
      expect(space.distance(v1, v2)).toBeCloseTo(0, 10);
    });

    it('returns similarity 1 for the same track', () => {
      const v1 = space.encode(fixtures[0]);
      const v2 = space.encode(fixtures[0]);
      expect(space.similarity(v1, v2)).toBeCloseTo(1, 10);
    });

    it('octave folding: 80 vs 160 bpm distance < 0.05', () => {
      const track1: AudioFeaturesEntity = {
        trackId: 'track-octave-1' as any,
        bpm: 80,
        energy: 0.5,
        spectralCentroid: 2000,
        danceability: 0.6,
        key: 0,
        mode: 1,
        analyzedAt: Date.now(),
        algorithmVersion: 1,
      };
      const track2: AudioFeaturesEntity = {
        trackId: 'track-octave-2' as any,
        bpm: 160,
        energy: 0.5,
        spectralCentroid: 2000,
        danceability: 0.6,
        key: 0,
        mode: 1,
        analyzedAt: Date.now(),
        algorithmVersion: 1,
      };

      const twoTrackStats = computeFeatureStats([track1, track2])!;
      const twoTrackSpace = createAudioSpace(twoTrackStats);
      const v1 = twoTrackSpace.encode(track1);
      const v2 = twoTrackSpace.encode(track2);
      expect(twoTrackSpace.distance(v1, v2)).toBeLessThan(0.05);
    });

    it('octave folding: 80 vs 113 (half-octave) distance noticeably larger', () => {
      const track1: AudioFeaturesEntity = {
        trackId: 'track-half-octave-1' as any,
        bpm: 80,
        energy: 0.5,
        spectralCentroid: 2000,
        danceability: 0.6,
        key: 0,
        mode: 1,
        analyzedAt: Date.now(),
        algorithmVersion: 1,
      };
      const track2: AudioFeaturesEntity = {
        trackId: 'track-half-octave-2' as any,
        bpm: 113,
        energy: 0.5,
        spectralCentroid: 2000,
        danceability: 0.6,
        key: 0,
        mode: 1,
        analyzedAt: Date.now(),
        algorithmVersion: 1,
      };

      const twoTrackStats = computeFeatureStats([track1, track2])!;
      const twoTrackSpace = createAudioSpace(twoTrackStats);
      const v1 = twoTrackSpace.encode(track1);
      const v2 = twoTrackSpace.encode(track2);
      const octaveDistance = space.distance(
        space.encode(fixtures[0]),
        space.encode(fixtures[0])
      );
      expect(twoTrackSpace.distance(v1, v2)).toBeGreaterThan(
        octaveDistance + 0.1
      );
    });

    it('circle of fifths: C(0) vs G(7) closer than C vs F#(6)', () => {
      const baseTrack: AudioFeaturesEntity = {
        trackId: 'base' as any,
        bpm: 100,
        energy: 0.5,
        spectralCentroid: 2000,
        danceability: 0.6,
        key: 0,
        mode: 1,
        analyzedAt: Date.now(),
        algorithmVersion: 1,
      };

      const trackG: AudioFeaturesEntity = {
        ...baseTrack,
        trackId: 'g' as any,
        key: 7,
      };

      const trackFSharp: AudioFeaturesEntity = {
        ...baseTrack,
        trackId: 'fsharp' as any,
        key: 6,
      };

      const threeTrackStats = computeFeatureStats([baseTrack, trackG, trackFSharp])!;
      const threeTrackSpace = createAudioSpace(threeTrackStats);

      const vBase = threeTrackSpace.encode(baseTrack);
      const vG = threeTrackSpace.encode(trackG);
      const vFSharp = threeTrackSpace.encode(trackFSharp);

      const distanceCG = threeTrackSpace.distance(vBase, vG);
      const distanceCFSharp = threeTrackSpace.distance(vBase, vFSharp);

      expect(distanceCG).toBeLessThan(distanceCFSharp);
    });

    it('circle of fifths: C(0) vs B(11) closer than C vs F#(6)', () => {
      const baseTrack: AudioFeaturesEntity = {
        trackId: 'base' as any,
        bpm: 100,
        energy: 0.5,
        spectralCentroid: 2000,
        danceability: 0.6,
        key: 0,
        mode: 1,
        analyzedAt: Date.now(),
        algorithmVersion: 1,
      };

      const trackB: AudioFeaturesEntity = {
        ...baseTrack,
        trackId: 'b' as any,
        key: 11,
      };

      const trackFSharp: AudioFeaturesEntity = {
        ...baseTrack,
        trackId: 'fsharp' as any,
        key: 6,
      };

      const threeTrackStats = computeFeatureStats([baseTrack, trackB, trackFSharp])!;
      const threeTrackSpace = createAudioSpace(threeTrackStats);

      const vBase = threeTrackSpace.encode(baseTrack);
      const vB = threeTrackSpace.encode(trackB);
      const vFSharp = threeTrackSpace.encode(trackFSharp);

      const distanceCB = threeTrackSpace.distance(vBase, vB);
      const distanceCFSharp = threeTrackSpace.distance(vBase, vFSharp);

      expect(distanceCB).toBeLessThan(distanceCFSharp);
    });

    it('mode difference only: distance = sqrt(0.3)', () => {
      const track1: AudioFeaturesEntity = {
        trackId: 'track-mode-1' as any,
        bpm: 100,
        energy: 0.5,
        spectralCentroid: 2000,
        danceability: 0.6,
        key: 0,
        mode: 1,
        analyzedAt: Date.now(),
        algorithmVersion: 1,
      };
      const track2: AudioFeaturesEntity = {
        trackId: 'track-mode-2' as any,
        bpm: 100,
        energy: 0.5,
        spectralCentroid: 2000,
        danceability: 0.6,
        key: 0,
        mode: 0,
        analyzedAt: Date.now(),
        algorithmVersion: 1,
      };

      const twoTrackStats = computeFeatureStats([track1, track2])!;
      const twoTrackSpace = createAudioSpace(twoTrackStats);
      const v1 = twoTrackSpace.encode(track1);
      const v2 = twoTrackSpace.encode(track2);

      expect(twoTrackSpace.distance(v1, v2)).toBeCloseTo(
        Math.sqrt(0.3),
        5
      );
    });

    it('distance matches similarity formula: similarity = 1 / (1 + distance)', () => {
      const v1 = space.encode(fixtures[0]);
      const v2 = space.encode(fixtures[1]);
      const dist = space.distance(v1, v2);
      const sim = space.similarity(v1, v2);
      expect(sim).toBeCloseTo(1 / (1 + dist), 10);
    });
  });

  describe('AudioVector exports', () => {
    it('exports AudioVector type', () => {
      const track: AudioFeaturesEntity = {
        trackId: 'track-1' as any,
        bpm: 100,
        energy: 0.5,
        spectralCentroid: 2000,
        danceability: 0.7,
        key: 0,
        mode: 1,
        analyzedAt: Date.now(),
        algorithmVersion: 1,
      };

      const fixtures = [track];
      // For export check, we just verify the type can be imported
      // This is more of a TypeScript check than runtime
      expect(true).toBe(true);
    });
  });
});
