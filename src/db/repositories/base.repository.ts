import type { Table, UpdateSpec } from "dexie";
import { AppFailure } from "@/lib/errors";
import { toDbError } from "@/db/errors/db.errors";

// Dexie rejects with its own error classes; this is the one place they become DbError.
export const guarded = async <T>(run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  }
  catch (error) {
    throw error instanceof AppFailure ? error : toDbError(error);
  }
};

export abstract class BaseRepository<TEntity, TId> {
  constructor(protected readonly table: Table<TEntity, TId>) {}

  findById(id: TId): Promise<TEntity | undefined> { return guarded(() => this.table.get(id)); }

  findAll(): Promise<TEntity[]> { return guarded(() => this.table.toArray()); }

  findByIds(ids: TId[]): Promise<TEntity[]> { return guarded(async () => (await this.table.bulkGet(ids)).filter((e): e is TEntity => e !== undefined)); }

  create(entity: TEntity): Promise<TId> { return guarded(() => this.table.add(entity)); }

  update(id: TId, changes: Partial<TEntity>): Promise<number> { return guarded(() => this.table.update(id, changes as UpdateSpec<TEntity>)); }

  delete(id: TId): Promise<void> { return guarded(() => this.table.delete(id)); }

  createMany(entities: TEntity[]): Promise<TId[]> { return guarded(() => this.table.bulkAdd(entities, { allKeys: true })); }

  upsert(entity: TEntity): Promise<TId> { return guarded(() => this.table.put(entity)); }

  upsertMany(entities: TEntity[]): Promise<TId[]> { return guarded(() => this.table.bulkPut(entities, { allKeys: true })); }

  updateMany(updates: { key: TId; changes: UpdateSpec<TEntity> }[]): Promise<number> { return guarded(() => this.table.bulkUpdate(updates)); }

  deleteMany(ids: TId[]): Promise<void> { return guarded(() => this.table.bulkDelete(ids)); }
}
