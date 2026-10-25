import { db } from "@/db";
import { QUEUE_SNAPSHOT_ID } from "@/db/entities";
import { attemptDb } from "@/db/errors/db.errors";
import type { Result } from "neverthrow";

/** The stored queue snapshot; its shape is the queue module's to check. */
export const queueSnapshotRepository = {
  async get(): Promise<Result<unknown, Error>> {
    return attemptDb(async () => (await db.queueSnapshot.get(QUEUE_SNAPSHOT_ID))?.snapshot ?? null);
  },
  async put(snapshot: unknown): Promise<Result<void, Error>> {
    return attemptDb(async () => {
      await db.queueSnapshot.put({ id: QUEUE_SNAPSHOT_ID, snapshot });
    });
  },
  async clear(): Promise<Result<void, Error>> {
    return attemptDb(async () => {
      await db.queueSnapshot.clear();
    });
  },
};
