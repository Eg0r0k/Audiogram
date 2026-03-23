import type { Table, UpdateSpec } from "dexie";
import { Result, ok, err } from "neverthrow";

export abstract class BaseRepository<TEntity, TId> {
  constructor(protected table: Table<TEntity, TId>) {}

  async findById(id: TId): Promise<Result<TEntity | undefined, Error>> {
    try {
      const entity = await this.table.get(id);
      return ok(entity);
    }
    catch (error) {
      return err(error as Error);
    }
  }

  async findAll(): Promise<Result<TEntity[], Error>> {
    try {
      const entities = await this.table.toArray();
      return ok(entities);
    }
    catch (error) {
      return err(error as Error);
    }
  }

  async findByIds(ids: TId[]): Promise<Result<TEntity[], Error>> {
    try {
      const results = await this.table.bulkGet(ids);
      const entities = results.filter((e): e is TEntity => e !== undefined);
      return ok(entities);
    }
    catch (error) {
      return err(error as Error);
    }
  }

  async create(entity: TEntity): Promise<Result<TId, Error>> {
    try {
      const id = await this.table.add(entity);
      return ok(id as TId);
    }
    catch (error) {
      return err(error as Error);
    }
  }

  async update(id: TId, changes: Partial<TEntity>): Promise<Result<number, Error>> {
    try {
      const count = await this.table.update(id, changes as UpdateSpec<TEntity>);
      return ok(count);
    }
    catch (error) {
      return err(error as Error);
    }
  }

  async delete(id: TId): Promise<Result<void, Error>> {
    try {
      await this.table.delete(id);
      return ok(undefined);
    }
    catch (error) {
      return err(error as Error);
    }
  }
}
