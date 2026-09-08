import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import type { RecommenderModelEntity } from "@/db/entities";
import { recommenderModelRepository } from "../recommenderModel.repository";

const weights: RecommenderModelEntity["weights"] = {
  audio: 0.35,
  trackTransition: 0.25,
  artistTransition: 0.1,
  affinity: 0.2,
  explore: 0.1,
};

beforeEach(async () => {
  await db.open();
  await db.recommenderModels.clear();
});

describe("recommenderModelRepository", () => {
  it("returns null when nothing is stored", async () => {
    expect((await recommenderModelRepository.get())._unsafeUnwrap()).toBeNull();
  });

  it("round-trips the single row and clear() removes it", async () => {
    (await recommenderModelRepository.put({
      weights,
      trainedAt: 1_700_000_000_000,
      examples: 240,
      positives: 120,
      negatives: 120,
    }))._unsafeUnwrap();

    expect((await recommenderModelRepository.get())._unsafeUnwrap()).toEqual({
      id: "weights",
      weights,
      trainedAt: 1_700_000_000_000,
      examples: 240,
      positives: 120,
      negatives: 120,
    });

    (await recommenderModelRepository.clear())._unsafeUnwrap();

    expect((await recommenderModelRepository.get())._unsafeUnwrap()).toBeNull();
  });

  it("put overwrites the previous row instead of adding a second one", async () => {
    const base = { weights, trainedAt: 1, examples: 20, positives: 10, negatives: 10 };
    (await recommenderModelRepository.put(base))._unsafeUnwrap();
    (await recommenderModelRepository.put({ ...base, trainedAt: 2 }))._unsafeUnwrap();

    expect(await db.recommenderModels.count()).toBe(1);
    expect((await recommenderModelRepository.get())._unsafeUnwrap()?.trainedAt).toBe(2);
  });
});
