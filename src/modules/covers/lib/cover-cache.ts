import { shallowReactive } from "vue";
import type { CoverOwnerType } from "@/db/entities";
import { getCoversByOwners, type CoverRow } from "@/queries/cover.queries";
import { getLogger } from "@/lib/logger";

//
// The one place Dexie-stored covers live in memory. Every consumer — a list
// row, a hero image, the media session — registers interest in an owner
// (album, track, artist, playlist) and reads the resolved URL or Blob from
// here; owners requested in the same tick go to Dexie as one query.
//
// Remote art never enters: catalog rows (ND, YT) show their source's URL and
// ephemeral streams carry their own cover, both resolved before any lookup
// here. A downloaded or pinned remote track stores its cover in Dexie like a
// local one and comes through this cache like a local one.
//
// Memory is bounded by what is held plus a small idle tail: an owner nobody
// holds any more stays for MAX_IDLE releases (scrolling back does not
// re-read Dexie), then its object URL is revoked and the Blob reference
// dropped. Writes go through `set`/`invalidate` from the query layer — the
// same points that used to feed vue-query — so there is no second copy to
// keep in sync.
//
// A read and a write can overlap: a batch that started before the write
// answers with the row as it was. A `set`/`invalidate` made while a batch is
// out bumps the owner's version, and a batch only stores an answer for the
// version it started with; a superseded answer is dropped and the owner is
// read again if anyone still holds it.
//

const MAX_IDLE = 64;

export interface CoverOwnerRef {
  ownerType: CoverOwnerType;
  ownerId: string;
}

export interface CoverEntry {
  url: string;
  blob: Blob;
  /** The row's `updatedAt`: a re-read that returns the same stamp keeps the URL. */
  updatedAt: number;
}

const keyOf = (owner: CoverOwnerRef) => `${owner.ownerType}:${owner.ownerId}`;

export const createCoverCache = (options: { maxIdle?: number } = {}) => {
  const maxIdle = options.maxIdle ?? MAX_IDLE;
  // key → entry, or null for an owner that has no cover. Shallow-reactive so
  // a consumer's computed tracks exactly its own key.
  const entries = shallowReactive(new Map<string, CoverEntry | null>());
  const owners = new Map<string, CoverOwnerRef>();
  const refs = new Map<string, number>();
  // Insertion order is the LRU order of owners nobody holds.
  const idle = new Set<string>();
  const pending = new Map<string, CoverOwnerRef>();
  // key → version the in-flight batch started with.
  const inflight = new Map<string, number>();
  // A version only tells a landing batch whether it was superseded, so one
  // is kept just while a batch is out for the key.
  const versions = new Map<string, number>();
  let flushScheduled = false;

  const versionOf = (key: string) => versions.get(key) ?? 0;

  const bump = (key: string) => {
    if (inflight.has(key)) versions.set(key, versionOf(key) + 1);
  };

  const drop = (key: string) => {
    idle.delete(key);
    const entry = entries.get(key);
    if (entry) URL.revokeObjectURL(entry.url);
    entries.delete(key);
    owners.delete(key);
  };

  const trimIdle = () => {
    for (const key of idle) {
      if (idle.size <= maxIdle) break;
      drop(key);
    }
  };

  // The same row again keeps its URL, so an <img> showing it is not asked
  // to reload. A re-read (after a library-wide invalidation) hands back a
  // fresh Blob of the same row, so it is the stamp that tells; a write is
  // the current row by definition and the stamp cannot tell — it is in
  // milliseconds and two writes to one owner can share it.
  const isSameRow = (previous: CoverEntry, row: CoverRow, written: boolean) =>
    written ? previous.blob === row.blob : previous.updatedAt === row.updatedAt;

  const store = (key: string, row: CoverRow | null, written = false) => {
    const previous = entries.get(key);
    if (previous === null && row === null) return;
    if (previous && row && isSameRow(previous, row, written)) return;
    entries.set(key, row ? { url: URL.createObjectURL(row.blob), blob: row.blob, updatedAt: row.updatedAt } : null);
    // A consumer switches to the new URL on its next render; the decoded
    // image it already painted does not depend on the old URL staying valid.
    if (previous) URL.revokeObjectURL(previous.url);
  };

  const settle = (key: string, started: number, answer: CoverRow | null | undefined) => {
    const current = versionOf(key);
    if (inflight.get(key) === started) inflight.delete(key);
    if (!inflight.has(key)) versions.delete(key);
    // Superseded by a write or an invalidation made while the batch was out:
    // that one has already stored, or scheduled, the current row.
    if (current !== started) return;
    if (answer !== undefined) store(key, answer);
    if (!refs.has(key) && entries.has(key)) idle.add(key);
  };

  const flush = async () => {
    flushScheduled = false;
    const batch = [...pending.values()];
    pending.clear();
    const byType = new Map<CoverOwnerType, string[]>();
    const started = new Map<string, number>();
    for (const owner of batch) {
      const key = keyOf(owner);
      const version = versionOf(key);
      inflight.set(key, version);
      started.set(key, version);
      const ids = byType.get(owner.ownerType) ?? [];
      ids.push(owner.ownerId);
      byType.set(owner.ownerType, ids);
    }
    await Promise.all([...byType.entries()].map(async ([ownerType, ids]) => {
      let rows: Map<string, CoverRow>;
      try {
        rows = await getCoversByOwners(ownerType, ids);
      }
      catch (error) {
        getLogger().warn(`[Covers] Batch lookup failed: ${String(error)}`);
        for (const id of ids) {
          const key = `${ownerType}:${id}`;
          settle(key, started.get(key)!, undefined);
        }
        return;
      }
      for (const id of ids) {
        const key = `${ownerType}:${id}`;
        settle(key, started.get(key)!, rows.get(id) ?? null);
      }
      trimIdle();
    }));
  };

  const enqueue = (key: string, owner: CoverOwnerRef) => {
    if (pending.has(key) || inflight.has(key)) return;
    pending.set(key, owner);
    if (!flushScheduled) {
      flushScheduled = true;
      queueMicrotask(() => {
        flush().catch(error => getLogger().warn(`[Covers] Batch lookup failed: ${String(error)}`));
      });
    }
  };

  // The row changed under a batch already out for it: that batch's answer is
  // stale, so it is dropped on landing and no longer blocks a new read.
  const supersede = (key: string) => {
    bump(key);
    inflight.delete(key);
  };

  const reread = (key: string, owner: CoverOwnerRef) => {
    supersede(key);
    enqueue(key, owner);
  };

  const release = (key: string) => {
    const count = (refs.get(key) ?? 1) - 1;
    if (count > 0) {
      refs.set(key, count);
      return;
    }
    refs.delete(key);
    if (entries.has(key)) {
      idle.delete(key);
      idle.add(key);
      trimIdle();
    }
  };

  /**
   * A consumer wants this owner's cover. Returns the release to call when it
   * no longer shows it. The entry arrives through `entryFor` once the batch
   * lands.
   */
  const acquire = (owner: CoverOwnerRef): (() => void) => {
    const key = keyOf(owner);
    owners.set(key, owner);
    refs.set(key, (refs.get(key) ?? 0) + 1);
    idle.delete(key);
    if (!entries.has(key)) enqueue(key, owner);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      release(key);
    };
  };

  /** `undefined` while unresolved, `null` for an owner without a cover. */
  const entryFor = (owner: CoverOwnerRef): CoverEntry | null | undefined => entries.get(keyOf(owner));

  /** The owner's cover was written: publish the stored row right away, no re-read. */
  const set = (owner: CoverOwnerRef, row: CoverRow | null) => {
    const key = keyOf(owner);
    owners.set(key, owner);
    bump(key);
    store(key, row, true);
    if (!refs.has(key)) {
      idle.delete(key);
      idle.add(key);
      trimIdle();
    }
  };

  /** The owner's cover changed or went away: re-read it for the consumers holding it, forget it otherwise. */
  const invalidate = (owner: CoverOwnerRef) => {
    const key = keyOf(owner);
    if (refs.has(key)) {
      reread(key, owner);
      return;
    }
    supersede(key);
    if (entries.has(key)) drop(key);
  };

  /** The library changed wholesale (import, rescan, clear). */
  const invalidateAll = () => {
    for (const key of [...idle]) drop(key);
    // A batch out for an owner released before it landed: nobody waits for
    // its answer, and it describes the old library.
    for (const key of [...inflight.keys()]) {
      if (!refs.has(key)) supersede(key);
    }
    for (const key of refs.keys()) {
      const owner = owners.get(key);
      if (owner) reread(key, owner);
    }
  };

  return {
    acquire,
    entryFor,
    set,
    invalidate,
    invalidateAll,
    /** Test seams. */
    get size() {
      return entries.size;
    },
    get trackedVersions() {
      return versions.size;
    },
  };
};

export const coverCache = createCoverCache();
