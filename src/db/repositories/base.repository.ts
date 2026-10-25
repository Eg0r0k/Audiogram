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

export interface Timestamped { updatedAt: number }

// Partial writes stamp the row unless the caller set updatedAt; whole-row writes
// (create, upsert) carry the caller's value, a restored snapshot included.
export abstract class TimestampedRepository<TEntity extends Timestamped, TId> extends BaseRepository<TEntity, TId> {
  protected stamp(changes: Partial<TEntity>, now = Date.now()): Partial<TEntity> {
    return { updatedAt: now, ...changes };
  }

  protected touch(row: TEntity, now = Date.now()): void {
    row.updatedAt = now;
  }

  override update(id: TId, changes: Partial<TEntity>): Promise<number> {
    return super.update(id, this.stamp(changes));
  }

  override updateMany(updates: { key: TId; changes: UpdateSpec<TEntity> }[]): Promise<number> {
    const now = Date.now();
    return super.updateMany(updates.map(({ key, changes }) => ({ key, changes: { updatedAt: now, ...changes } as UpdateSpec<TEntity> })));
  }
}
