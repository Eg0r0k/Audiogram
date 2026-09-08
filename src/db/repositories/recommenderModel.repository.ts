import { db } from "@/db";
import type { RecommenderModelEntity } from "@/db/entities";
import { err, ok, type Result } from "neverthrow";

const MODEL_ID = "weights" as const;

export const recommenderModelRepository = {
  async get(): Promise<Result<RecommenderModelEntity | null, Error>> {
    try {
      return ok((await db.recommenderModels.get(MODEL_ID)) ?? null);
    }
    catch (error) {
      return err(error as Error);
    }
  },
  async put(model: Omit<RecommenderModelEntity, "id">): Promise<Result<void, Error>> {
    try {
      await db.recommenderModels.put({ id: MODEL_ID, ...model });
      return ok(undefined);
    }
    catch (error) {
      return err(error as Error);
    }
  },
};
