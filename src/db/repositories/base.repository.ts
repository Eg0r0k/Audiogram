import type { Table, UpdateSpec } from "dexie";
import type { Result } from "neverthrow";
import { attemptDb } from "@/db/errors/db.errors";

export abstract class BaseRepository<TEntity, TId> {
  constructor(protected table: Table<TEntity, TId>) {}

  async findById(id: TId): Promise<Result<TEntity | undefined, Error>> {
    return attemptDb(() => this.table.get(id));
  }

  async findAll(): Promise<Result<TEntity[], Error>> {
    return attemptDb(() => this.table.toArray());
  }

  async findByIds(ids: TId[]): Promise<Result<TEntity[], Error>> {
    return attemptDb(async () => {
      const results = await this.table.bulkGet(ids);
      return results.filter((e): e is TEntity => e !== undefined);
    });
  }

  async create(entity: TEntity): Promise<Result<TId, Error>> {
    return attemptDb(async () => (await this.table.add(entity)) as TId);
  }

  async update(id: TId, changes: Partial<TEntity>): Promise<Result<number, Error>> {
    return attemptDb(() => this.table.update(id, changes as UpdateSpec<TEntity>));
  }

  async delete(id: TId): Promise<Result<void, Error>> {
    return attemptDb(async () => {
      await this.table.delete(id);
    });
  }

  async createMany(entities: TEntity[]): Promise<Result<TId[], Error>> {
    return attemptDb(() => this.table.bulkAdd(entities, { allKeys: true }));
  }

  async upsert(entity: TEntity): Promise<Result<TId, Error>> {
    return attemptDb(async () => (await this.table.put(entity)) as TId);
  }

  async upsertMany(entities: TEntity[]): Promise<Result<TId[], Error>> {
    return attemptDb(() => this.table.bulkPut(entities, { allKeys: true }));
  }

  async updateMany(
    updates: { key: TId; changes: UpdateSpec<TEntity> }[],
  ): Promise<Result<number, Error>> {
    return attemptDb(() => this.table.bulkUpdate(updates));
  }

  async deleteMany(ids: TId[]): Promise<Result<void, Error>> {
    return attemptDb(async () => {
      await this.table.bulkDelete(ids);
    });
  }
}
