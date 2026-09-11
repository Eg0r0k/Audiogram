import { describe, it, expect } from "vitest";
import { makeLcg } from "./random";

describe("makeLcg", () => {
  it("produces the same sequence for the same seed, and a different one for a different seed", () => {
    const a = Array.from({ length: 5 }, makeLcg(42));
    const b = Array.from({ length: 5 }, makeLcg(42));
    const c = Array.from({ length: 5 }, makeLcg(1));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});
