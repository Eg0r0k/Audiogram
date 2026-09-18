import { describe, expect, it } from "vitest";
import { fitWithin } from "../fit-within";

describe("fitWithin", () => {
  it("leaves an image that already fits alone", () => {
    expect(fitWithin(640, 480, 800)).toBeNull();
  });

  it("treats the limit itself as fitting", () => {
    expect(fitWithin(800, 800, 800)).toBeNull();
  });

  it("scales a square cover down to the limit", () => {
    expect(fitWithin(3000, 3000, 800)).toEqual({ width: 800, height: 800 });
  });

  it("fits a landscape cover by its longer side", () => {
    expect(fitWithin(1600, 900, 800)).toEqual({ width: 800, height: 450 });
  });

  it("fits a portrait cover by its longer side", () => {
    expect(fitWithin(900, 1600, 800)).toEqual({ width: 450, height: 800 });
  });

  it("scales when only one side exceeds the limit", () => {
    expect(fitWithin(1200, 400, 800)).toEqual({ width: 800, height: 267 });
  });

  it("never rounds a side down to zero", () => {
    expect(fitWithin(4000, 3, 800)).toEqual({ width: 800, height: 1 });
  });
});
