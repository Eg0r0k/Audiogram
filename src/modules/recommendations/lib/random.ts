/** Deterministic LCG PRNG — same seed always produces the same sequence, in [0, 1). */
export const makeLcg = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
};
