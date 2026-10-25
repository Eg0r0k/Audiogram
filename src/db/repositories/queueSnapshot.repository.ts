import { db } from "@/db";
import { QUEUE_SNAPSHOT_ID } from "@/db/entities";
import { tableOf, type TableMap, type TableSource } from "@/db/tables";
import { guarded } from "./base.repository";

/** The stored queue snapshot; its shape is the queue module's to check. */
export class QueueSnapshotRepository {
  private readonly table: TableMap["queueSnapshot"];

  constructor(source: TableSource = db) {
    this.table = tableOf(source, "queueSnapshot");
  }

  async get(): Promise<unknown> {
    return guarded(async () => (await this.table.get(QUEUE_SNAPSHOT_ID))?.snapshot ?? null);
  }

  async put(snapshot: unknown): Promise<void> {
    return guarded(async () => {
      await this.table.put({ id: QUEUE_SNAPSHOT_ID, snapshot });
    });
  }

  async clear(): Promise<void> {
    return guarded(() => this.table.clear());
  }
}

export const queueSnapshotRepository = new QueueSnapshotRepository();
