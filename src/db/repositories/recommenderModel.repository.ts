import { db } from "@/db";
import type { RecommenderModelEntity } from "@/db/entities";
import { tableOf, type TableMap, type TableSource } from "@/db/tables";
import { guarded } from "./base.repository";

const MODEL_ID = "weights" as const;

export class RecommenderModelRepository {
  private readonly table: TableMap["recommenderModels"];

  constructor(source: TableSource = db) {
    this.table = tableOf(source, "recommenderModels");
  }

  async get(): Promise<RecommenderModelEntity | null> {
    return guarded(async () => (await this.table.get(MODEL_ID)) ?? null);
  }

  async put(model: Omit<RecommenderModelEntity, "id">): Promise<void> {
    return guarded(async () => {
      await this.table.put({ id: MODEL_ID, ...model });
    });
  }

  async clear(): Promise<void> {
    return guarded(() => this.table.clear());
  }
}

export const recommenderModelRepository = new RecommenderModelRepository();
