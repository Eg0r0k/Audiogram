import { db } from "@/db";
import { QUEUE_SNAPSHOT_ID } from "@/db/entities";
import { toDbError } from "@/db/errors/db.errors";
import { err, ok, type Result } from "neverthrow";

/** The stored queue snapshot; its shape is the queue module's to check. */
export const queueSnapshotRepository = {
  async get(): Promise<Result<unknown, Error>> {
    try {
      return ok((await db.queueSnapshot.get(QUEUE_SNAPSHOT_ID))?.snapshot ?? null);
    }
    catch (error) {
      return err(toDbError(error));
    }
  },
  async put(snapshot: unknown): Promise<Result<void, Error>> {
    try {
      await db.queueSnapshot.put({ id: QUEUE_SNAPSHOT_ID, snapshot });
      return ok(undefined);
    }
    catch (error) {
      return err(toDbError(error));
    }
  },
  async clear(): Promise<Result<void, Error>> {
    try {
      await db.queueSnapshot.clear();
      return ok(undefined);
    }
    catch (error) {
      return err(toDbError(error));
    }
  },
};
