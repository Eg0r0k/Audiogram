import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it, vi } from "vitest";

const logger = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/logger", () => ({ getLogger: () => logger }));

import { db, openDatabase } from "@/db";

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  db.close();
});

const openTaking = (ms: number) => {
  let clock = 1_000;
  const open = db.open.bind(db);
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  vi.spyOn(db, "open").mockImplementationOnce(() => {
    clock += ms;
    return open();
  });
  return openDatabase();
};

describe("openDatabase", () => {
  it("opens a fresh database and reports ok", async () => {
    const result = await openDatabase();

    expect(result.isOk()).toBe(true);
    expect(db.isOpen()).toBe(true);
    expect(db.verno).toBeGreaterThanOrEqual(11);
  });

  it("classifies an open failure instead of throwing", async () => {
    vi.spyOn(db, "open").mockRejectedValueOnce(new Dexie.UpgradeError("upgrade blew up"));

    const result = await openDatabase();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("UPGRADE");
      expect(result.error.message).toBe("upgrade blew up");
    }
  });

  it("logs a slow open with its time and schema version", async () => {
    const result = await openTaking(1_500);

    expect(result.isOk()).toBe(true);
    expect(logger.info).toHaveBeenCalledExactlyOnceWith(`[DB] open took 1500 ms (schema v${db.verno})`);
  });

  it("logs nothing when the open takes a second or less", async () => {
    const result = await openTaking(1_000);

    expect(result.isOk()).toBe(true);
    expect(logger.info).not.toHaveBeenCalled();
  });
});
