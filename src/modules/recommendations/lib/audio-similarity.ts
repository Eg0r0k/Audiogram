import type { AudioFeaturesEntity } from "@/db/entities";

export interface Moments {
  mean: number;
  std: number;
}

export interface FeatureStats {
  /** log2(bpm) */
  tempo: Moments;
  energy: Moments;
  /** ln(spectralCentroid) */
  centroid: Moments;
  danceability: Moments;
}

export interface AudioVector {
  tempoLog2: number; // raw, centred later (octave folding needs raw units)
  energy: number; // z
  centroid: number; // z
  danceability: number; // z
  mode: number; // 0 | 1
  fifths: number; // position on the circle of fifths, 0..11
}

const WEIGHTS = {
  tempo: 1,
  energy: 1,
  centroid: 1,
  danceability: 1,
  mode: 0.3,
  key: 0.2,
} as const;

const moments = (values: number[]): Moments => {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance
    = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  return { mean, std: std > 1e-6 ? std : 1 };
};

export const computeFeatureStats = (
  features: readonly AudioFeaturesEntity[],
): FeatureStats | null => {
  if (features.length < 2) return null;
  return {
    tempo: moments(features.map(f => Math.log2(Math.max(f.bpm, 1)))),
    energy: moments(features.map(f => f.energy)),
    centroid: moments(
      features.map(f => Math.log(Math.max(f.spectralCentroid, 1))),
    ),
    danceability: moments(features.map(f => f.danceability)),
  };
};

/** Distance in octaves after folding to the nearest octave: 80 vs 160 bpm ≈ 0. */
const foldedTempoDelta = (a: number, b: number): number => {
  const d = a - b;
  return Math.min(Math.abs(d), Math.abs(d - 1), Math.abs(d + 1));
};

export interface AudioSpace {
  encode(f: AudioFeaturesEntity): AudioVector;
  distance(a: AudioVector, b: AudioVector): number;
  similarity(a: AudioVector, b: AudioVector): number;
}

export const createAudioSpace = (stats: FeatureStats): AudioSpace => {
  const z = (v: number, m: Moments) => (v - m.mean) / m.std;

  const encode = (f: AudioFeaturesEntity): AudioVector => ({
    tempoLog2: Math.log2(Math.max(f.bpm, 1)),
    energy: z(f.energy, stats.energy),
    centroid: z(Math.log(Math.max(f.spectralCentroid, 1)), stats.centroid),
    danceability: z(f.danceability, stats.danceability),
    mode: f.mode,
    fifths: (f.key * 7) % 12,
  });

  const distance = (a: AudioVector, b: AudioVector): number => {
    const tempo
      = foldedTempoDelta(a.tempoLog2, b.tempoLog2) / stats.tempo.std;
    const keySteps = Math.abs(a.fifths - b.fifths);
    const key = Math.min(keySteps, 12 - keySteps) / 6;
    const sum
      = WEIGHTS.tempo * tempo ** 2
        + WEIGHTS.energy * (a.energy - b.energy) ** 2
        + WEIGHTS.centroid * (a.centroid - b.centroid) ** 2
        + WEIGHTS.danceability * (a.danceability - b.danceability) ** 2
        + WEIGHTS.mode * (a.mode === b.mode ? 0 : 1)
        + WEIGHTS.key * key ** 2;
    return Math.sqrt(sum);
  };

  return {
    encode,
    distance,
    similarity: (a, b) => 1 / (1 + distance(a, b)),
  };
};
