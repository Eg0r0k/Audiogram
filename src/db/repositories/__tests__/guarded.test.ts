import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import type { TagEntity } from "@/db/entities";
import { DbError } from "@/db/errors/db.errors";
import { AppFailure } from "@/lib/errors";
import { TagId } from "@/types/ids";
import { guarded } from "../base.repository";
import { tagRepository } from "../tag.repository";

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map(table => table.clear()));
});

describe("guarded", () => {
  it("turns a Dexie ConstraintError into a DbError with code CONSTRAINT", async () => {
    const tag: TagEntity = { id: TagId("t1"), name: "rock" };
    await tagRepository.create(tag);

    const failure = await tagRepository.create(tag).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(DbError);
    expect((failure as DbError).code).toBe("CONSTRAINT");
    expect(await db.tags.count()).toBe(1);
  });

  it("passes an AppFailure thrown inside through unchanged", async () => {
    const failure = new AppFailure({ domain: "cancelled", message: "stopped" });

    const thrown = await guarded(async () => {
      await db.tags.count();
      throw failure;
    }).catch((error: unknown) => error);

    expect(thrown).toBe(failure);
  });

  it("returns the value of a successful run", async () => {
    await db.tags.bulkAdd([{ id: TagId("t1"), name: "rock" }, { id: TagId("t2"), name: "jazz" }]);

    expect(await guarded(() => db.tags.count())).toBe(2);
  });
});
