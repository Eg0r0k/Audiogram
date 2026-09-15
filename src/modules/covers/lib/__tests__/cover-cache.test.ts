import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  findByOwners: vi.fn(),
}));
vi.mock("@/queries/cover.queries", () => ({
  getCoversByOwners: (type: string, ids: string[]) => repo.findByOwners(type, ids),
}));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ warn: vi.fn() }) }));

import { createCoverCache } from "../cover-cache";

const blob = (name: string) => new Blob([name], { type: "image/jpeg" });
const row = (name: string, updatedAt = 1) => ({ blob: blob(name), updatedAt });
const album = (id: string) => ({ ownerType: "album" as const, ownerId: id });
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

type Rows = Map<string, { blob: Blob; updatedAt: number }>;

const deferred = () => {
  let resolve!: (rows: Rows) => void;
  const promise = new Promise<Rows>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe("cover cache", () => {
  let revoked: string[];

  beforeEach(() => {
    revoked = [];
    let n = 0;
    URL.createObjectURL = vi.fn(() => `blob:${++n}`);
    URL.revokeObjectURL = vi.fn((url: string) => { revoked.push(url); });
    repo.findByOwners.mockReset();
    repo.findByOwners.mockImplementation(async (_type: string, ids: string[]) =>
      new Map(ids.filter(id => !id.startsWith("none")).map(id => [id, row(id)])),
    );
  });

  it("reads every owner requested in one tick with a single query", async () => {
    const cache = createCoverCache();
    cache.acquire(album("a"));
    cache.acquire(album("b"));
    cache.acquire(album("a"));
    expect(cache.entryFor(album("a"))).toBeUndefined();

    await flush();

    expect(repo.findByOwners).toHaveBeenCalledTimes(1);
    expect(repo.findByOwners.mock.calls[0][1]).toEqual(["a", "b"]);
    expect(cache.entryFor(album("a"))?.url).toBe("blob:1");
    expect(cache.entryFor(album("b"))?.url).toBe("blob:2");
    expect(cache.entryFor(album("a"))?.blob).toBeInstanceOf(Blob);
  });

  it("remembers an owner without a cover as null instead of asking again", async () => {
    const cache = createCoverCache();
    cache.acquire(album("none-1"));
    await flush();
    expect(cache.entryFor(album("none-1"))).toBeNull();

    cache.acquire(album("none-1"));
    await flush();
    expect(repo.findByOwners).toHaveBeenCalledTimes(1);
  });

  it("keeps a released owner for quick re-mounts and revokes past the idle cap", async () => {
    const cache = createCoverCache({ maxIdle: 2 });
    const releases = ["a", "b", "c"].map(id => cache.acquire(album(id)));
    await flush();

    releases[0]();
    releases[1]();
    expect(revoked).toEqual([]);
    // A re-mount within the idle tail costs no query.
    cache.acquire(album("a"));
    await flush();
    expect(repo.findByOwners).toHaveBeenCalledTimes(1);

    // Third idle owner: the oldest idle one ("b") goes.
    releases[2]();
    const releaseD = cache.acquire(album("d"));
    await flush();
    releaseD();
    expect(cache.entryFor(album("b"))).toBeUndefined();
    expect(revoked).toContain("blob:2");
    expect(cache.entryFor(album("a"))?.url).toBe("blob:1");
  });

  it("publishes a written cover at once and keeps the URL for an unchanged row", async () => {
    const cache = createCoverCache();
    cache.acquire(album("a"));
    await flush();
    const first = cache.entryFor(album("a"))!;

    const edited = row("edited", 2);
    cache.set(album("a"), edited);
    expect(cache.entryFor(album("a"))?.blob).toBe(edited.blob);
    expect(cache.entryFor(album("a"))?.url).toBe("blob:2");
    expect(revoked).toContain(first.url);

    cache.set(album("a"), edited);
    expect(cache.entryFor(album("a"))?.url).toBe("blob:2");

    cache.set(album("a"), null);
    expect(cache.entryFor(album("a"))).toBeNull();
    expect(repo.findByOwners).toHaveBeenCalledTimes(1);
  });

  // The repository stamps `updatedAt` in milliseconds, so two writes to one
  // owner can carry the same stamp; a written row is the current row either
  // way and must show.
  it("publishes a written row whose stamp matches the shown one but whose blob differs", async () => {
    const cache = createCoverCache();
    cache.acquire(album("a"));
    await flush();

    cache.set(album("a"), row("first", 7));
    const second = row("second", 7);
    cache.set(album("a"), second);

    expect(cache.entryFor(album("a"))?.blob).toBe(second.blob);
    expect(cache.entryFor(album("a"))?.url).toBe("blob:3");
  });

  // A library-wide invalidation (import, folder sync) re-reads every held
  // owner. Dexie hands back a fresh Blob instance each time; the row itself
  // has not changed, so the URL every <img> shows must not change either.
  it("a re-read of an unchanged row keeps the URL, a newer row replaces it", async () => {
    const cache = createCoverCache();
    cache.acquire(album("a"));
    await flush();

    cache.invalidate(album("a"));
    await flush();
    expect(cache.entryFor(album("a"))?.url).toBe("blob:1");
    expect(revoked).toEqual([]);

    repo.findByOwners.mockImplementation(async () => new Map([["a", row("newer", 2)]]));
    cache.invalidate(album("a"));
    await flush();
    expect(cache.entryFor(album("a"))?.url).toBe("blob:2");
    expect(revoked).toEqual(["blob:1"]);
  });

  it("re-reads a held owner on invalidate and forgets an idle one", async () => {
    const cache = createCoverCache();
    const release = cache.acquire(album("a"));
    cache.acquire(album("b"));
    await flush();
    release();

    repo.findByOwners.mockImplementation(async (_type: string, ids: string[]) =>
      new Map(ids.map(id => [id, row(`${id}-2`, 2)])),
    );
    cache.invalidate(album("a"));
    cache.invalidate(album("b"));
    await flush();

    expect(cache.entryFor(album("a"))).toBeUndefined();
    expect(revoked).toContain("blob:1");
    expect(cache.entryFor(album("b"))?.url).toBe("blob:3");
    expect(revoked).toContain("blob:2");
  });

  it("invalidateAll drops idle owners and refreshes the held ones", async () => {
    const cache = createCoverCache();
    const release = cache.acquire(album("a"));
    cache.acquire(album("b"));
    await flush();
    release();
    repo.findByOwners.mockClear();

    cache.invalidateAll();
    await flush();

    expect(cache.size).toBe(1);
    expect(repo.findByOwners).toHaveBeenCalledTimes(1);
    expect(repo.findByOwners.mock.calls[0][1]).toEqual(["b"]);
  });

  // A version only tells a landing batch whether it was superseded; kept
  // past that it would grow with every owner ever written or invalidated.
  it("forgets an owner's version once no batch is out for it", async () => {
    const cache = createCoverCache();
    const release = cache.acquire(album("a"));
    await flush();

    cache.set(album("a"), row("written", 2));
    release();
    cache.invalidate(album("a"));

    expect(cache.trackedVersions).toBe(0);
  });

  describe("a read that overlaps a write", () => {
    // The read started before the write, so its answer describes the row as
    // it was. Landing after the write it must not undo it.
    it("a write made while the owner is being read wins over the read's answer", async () => {
      const cache = createCoverCache();
      const read = deferred();
      repo.findByOwners.mockImplementationOnce(() => read.promise);
      cache.acquire(album("a"));
      await flush();

      const written = row("written", 5);
      cache.set(album("a"), written);
      read.resolve(new Map([["a", row("stale", 1)]]));
      await flush();

      expect(cache.entryFor(album("a"))?.blob).toBe(written.blob);
    });

    it("an invalidation made while the owner is being read schedules another read", async () => {
      const cache = createCoverCache();
      const first = deferred();
      repo.findByOwners.mockImplementationOnce(() => first.promise);
      cache.acquire(album("a"));
      await flush();

      cache.invalidate(album("a"));
      first.resolve(new Map([["a", row("stale", 1)]]));
      await flush();

      expect(repo.findByOwners).toHaveBeenCalledTimes(2);
      expect(cache.entryFor(album("a"))?.blob).toEqual(blob("a"));
      expect(cache.entryFor(album("a"))?.updatedAt).toBe(1);
    });

    it("invalidateAll reaches an owner whose read is in flight", async () => {
      const cache = createCoverCache();
      const first = deferred();
      repo.findByOwners.mockImplementationOnce(() => first.promise);
      cache.acquire(album("a"));
      await flush();

      cache.invalidateAll();
      first.resolve(new Map());
      await flush();

      expect(repo.findByOwners).toHaveBeenCalledTimes(2);
      expect(cache.entryFor(album("a"))?.url).toBe("blob:1");
    });

    // The row unmounted before its batch landed, the owner was invalidated
    // meanwhile, and the row is back. The stale answer must be dropped and
    // the owner read again — not left with no entry and nothing pending.
    it("an invalidation of an owner nobody holds, read in flight, lets a re-mount read it again", async () => {
      const cache = createCoverCache();
      const first = deferred();
      repo.findByOwners.mockImplementationOnce(() => first.promise);
      const release = cache.acquire(album("a"));
      await flush();
      release();

      cache.invalidate(album("a"));
      cache.acquire(album("a"));
      first.resolve(new Map([["a", row("stale", 1)]]));
      await flush();

      expect(repo.findByOwners).toHaveBeenCalledTimes(2);
      expect(cache.entryFor(album("a"))?.blob).toEqual(blob("a"));
    });

    it("invalidateAll drops the answer of an owner nobody holds whose read is in flight", async () => {
      const cache = createCoverCache();
      const first = deferred();
      repo.findByOwners.mockImplementationOnce(() => first.promise);
      const release = cache.acquire(album("a"));
      await flush();
      release();

      cache.invalidateAll();
      first.resolve(new Map([["a", row("stale", 1)]]));
      await flush();
      expect(cache.entryFor(album("a"))).toBeUndefined();

      cache.acquire(album("a"));
      await flush();
      expect(repo.findByOwners).toHaveBeenCalledTimes(2);
      expect(cache.entryFor(album("a"))?.blob).toEqual(blob("a"));
    });

    it("a later acquire after a superseded read still gets an answer", async () => {
      const cache = createCoverCache();
      const first = deferred();
      repo.findByOwners.mockImplementationOnce(() => first.promise);
      const release = cache.acquire(album("a"));
      await flush();

      cache.set(album("a"), row("written", 5));
      first.resolve(new Map());
      await flush();
      release();
      cache.invalidate(album("a"));
      expect(cache.entryFor(album("a"))).toBeUndefined();

      cache.acquire(album("a"));
      await flush();
      expect(cache.entryFor(album("a"))?.blob).toEqual(blob("a"));
    });
  });
});
