import { err, ok, Result } from "neverthrow";
import { db } from ".";
import { Table } from "dexie";

type RwCallback<T> = () => Promise<T>;

export class UnitOfWork {
  async run<T>(callback: RwCallback<T>): Promise<Result<T, Error>> {
    try {
      const result = await db.transaction("rw", db.tables, callback);
      return ok(result);
    }
    catch (error) {
      return err(error as Error);
    }
  }

  async runScoped<T>(
    tables: Table[],
    callback: RwCallback<T>,
  ): Promise<Result<T, Error>> {
    try {
      const result = await db.transaction("rw", tables, callback);
      return ok(result);
    }
    catch (error) {
      return err(error as Error);
    }
  }
}

export const unitOfWork = new UnitOfWork();
