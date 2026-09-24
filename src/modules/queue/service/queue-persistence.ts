import { PlaylistId, type QueueItemId } from "@/types/ids";
import { REPEAT_MODES, type EphemeralTrack, type PlayerTrack, type RepeatMode, type Track } from "@/modules/player/types";
import { playlistRepository, queueSnapshotRepository, trackRepository } from "@/db/repositories";
import { LEGACY_QUEUE_STORAGE_KEY, QUEUE_CURSOR_STORAGE_KEY } from "@/db/entities";
import { mapTrackEntityToPlayerTrack } from "@/modules/player/utils/trackEntity";
import { unique, unwrapResult } from "@/queries/shared";
import { getLogger } from "@/lib/logger";
import { migrateProxyUrl } from "@/lib/stream-url";
import { ndPlaylistId, parseTrackRef } from "@/types/track-ref";
import type { QueueItem, QueueSource, QueueState } from "../types";
import { getItemsByOrder } from "../lib/queue-order";

export const QUEUE_STORAGE_KEY = QUEUE_CURSOR_STORAGE_KEY;
const LEGACY_PLAYER_STORAGE_KEY = "lyra-player";

interface PersistedLibraryTrack {
  kind: "library";
  trackId: Track["id"];
}

type PersistedEphemeralTrack = Pick<EphemeralTrack, "id" | "title" | "artist" | "albumName" | "duration" | "cover"> & {
  kind: "ephemeral";
  source: { type: "path"; path: string } | { type: "url"; url: string };
};

type PersistedQueueTrack = PersistedLibraryTrack | PersistedEphemeralTrack;

interface PersistedQueueItem {
  id: QueueItemId;
  track: PersistedQueueTrack;
  source: QueueSource;
  addedAt: number;
  cover?: string | null;
}

export interface PersistedQueueSnapshot {
  version: 1;
  queue: PersistedQueueItem[];
  originalQueueOrder: QueueItemId[];
  currentIndex: number;
  /**
   * Authoritative over currentIndex on restore: tracks deleted from the
   * library between sessions shorten the restored queue, and a positional
   * index would then point at a neighbour. Older v1 snapshots lack it.
   */
  currentItemId?: QueueItemId;
  isShuffled: boolean;
}

/** What a skip changes; the snapshot itself is written only when the items or their order do. */
export interface PersistedQueueCursor {
  currentItemId: QueueItemId | null;
}

const isRepeatMode = (value: unknown): value is RepeatMode =>
  typeof value === "string" && (REPEAT_MODES as readonly string[]).includes(value);

// One-time migration: repeatMode used to persist under the player's key. A
// queue entry that has never stored one adopts the player's value, so the
// upgrade does not reset the user's repeat setting. The pre-v19 queue key is
// read too: it is still there when the database upgrade could not run.
export const readLegacyRepeatMode = (): RepeatMode | null => {
  try {
    const own = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (own && "repeatMode" in JSON.parse(own)) return null;
    for (const key of [LEGACY_QUEUE_STORAGE_KEY, LEGACY_PLAYER_STORAGE_KEY]) {
      const legacy = localStorage.getItem(key);
      const mode: unknown = legacy ? JSON.parse(legacy).repeatMode : undefined;
      if (isRepeatMode(mode)) return mode;
    }
    return null;
  }
  catch {
    return null;
  }
};

/**
 * Coalesces snapshot writes to the database: a drag-reorder is a burst of
 * commits, and each write clones the whole queue. Pending writes go out at
 * once when the page is hidden or unloading. `null` clears the stored queue.
 */
export const createQueueSnapshotWriter = (delayMs: number) => {
  let pending: { snapshot: PersistedQueueSnapshot | null } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (!pending) return;
    const { snapshot } = pending;
    pending = null;
    const write = snapshot ? queueSnapshotRepository.put(snapshot) : queueSnapshotRepository.clear();
    write.then((result) => {
      if (result.isErr()) getLogger().error(`[Queue] Failed to store the queue: ${result.error.message}`);
    }).catch(() => {});
  };

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  }

  const schedule = (snapshot: PersistedQueueSnapshot | null) => {
    pending = { snapshot };
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, delayMs);
  };

  return { schedule, flush };
};

/**
 * The stored snapshot with the cursor applied. The cursor is written on
 * every skip and the snapshot only on edits, so the cursor is the newer of
 * the two; one naming an entry the snapshot lacks (a write lost on exit)
 * falls back to the snapshot's own. Throws when the database read fails.
 */
export const loadPersistedQueue = async (
  cursor: PersistedQueueCursor | null,
): Promise<PersistedQueueSnapshot | null> => {
  const stored = (await unwrapResult(queueSnapshotRepository.get())) as { version: number } | null;
  // An unknown version is left for the caller to reject, not read here.
  if (!stored || !cursor || stored.version !== 1) return stored as PersistedQueueSnapshot | null;
  const snapshot = stored as PersistedQueueSnapshot;
  if (cursor.currentItemId === null) {
    return { ...snapshot, currentIndex: -1, currentItemId: undefined };
  }
  const currentIndex = snapshot.queue.findIndex(item => item.id === cursor.currentItemId);
  return currentIndex >= 0
    ? { ...snapshot, currentIndex, currentItemId: cursor.currentItemId }
    : snapshot;
};

// The media server's port and token change every launch, so any stored
// proxy URL (playback or cover) must be re-pointed at the live base;
// foreign URLs pass through.
const migrateCover = (cover: string | null | undefined) =>
  cover ? migrateProxyUrl(cover) : cover;

// Queue items are never edited in place — every change is a new object — so
// the serialized form of an item can be reused for as long as the item
// lives. A commit that only moves the selection then rebuilds the snapshot
// without re-serializing a single entry.
const serializedItems = new WeakMap<QueueItem, PersistedQueueItem | null>();

const serializeQueueItem = (item: QueueItem): PersistedQueueItem | null => {
  const cached = serializedItems.get(item);
  if (cached !== undefined) return cached;
  const serialized = serializeQueueItemUncached(item);
  serializedItems.set(item, serialized);
  return serialized;
};

const serializeQueueItemUncached = (item: QueueItem): PersistedQueueItem | null => {
  if (item.track.kind === "library") {
    return {
      id: item.id,
      track: {
        kind: "library",
        trackId: item.track.id,
      },
      source: item.source,
      addedAt: item.addedAt,
      cover: item.cover,
    };
  }

  // A dropped File cannot be reopened next session.
  if (item.track.source.type === "file") {
    return null;
  }

  return {
    id: item.id,
    track: {
      kind: "ephemeral",
      id: item.track.id,
      title: item.track.title,
      artist: item.track.artist,
      albumName: item.track.albumName,
      duration: item.track.duration,
      cover: item.track.cover,
      source: item.track.source,
    },
    source: item.source,
    addedAt: item.addedAt,
    cover: item.cover,
  };
};

/**
 * The v1 format stores both orders; they are derived from the canonical
 * state here, so the file layout is unchanged while the runtime model is.
 */
export const buildPersistedQueueSnapshot = (input: {
  /** Playback order. */
  queue: readonly QueueItem[];
  /** Original (added) order. */
  items: readonly QueueItem[];
  currentItemId: QueueItemId | null;
  isShuffled: boolean;
}): PersistedQueueSnapshot | null => {
  const persistedQueue = input.queue
    .map(item => serializeQueueItem(item))
    .filter((item): item is PersistedQueueItem => item !== null);

  if (persistedQueue.length === 0) {
    return null;
  }

  const persistedIds = new Set(persistedQueue.map(item => item.id));
  const persistedCurrentItemId = input.currentItemId !== null && persistedIds.has(input.currentItemId)
    ? input.currentItemId
    : undefined;

  return {
    version: 1,
    queue: persistedQueue,
    originalQueueOrder: input.items
      .map(item => item.id)
      .filter(id => persistedIds.has(id)),
    currentIndex: persistedCurrentItemId
      ? persistedQueue.findIndex(item => item.id === persistedCurrentItemId)
      : -1,
    currentItemId: persistedCurrentItemId,
    isShuffled: input.isShuffled,
  };
};

// parseTrackRef only reads the source prefix, so any branded id string is a
// valid input; the cast keeps it usable for playlist and ephemeral ids too.
const sourceKindOfId = (id: string) => parseTrackRef(id as Track["id"]).kind;

const persistedTrackId = (track: PersistedQueueTrack): string =>
  track.kind === "library" ? track.trackId : track.id;

/**
 * Snapshots written before ND playlist ids were branded store the raw server
 * id in a playlist source, which matches neither the sidebar row nor the
 * playlist route any more.
 *
 * Re-branding needs proof rather than a guess: an unprefixed id is exactly
 * what a local playlist looks like, and a local playlist may legitimately
 * hold nothing but ND tracks. So an id is only rewritten when no local
 * playlist owns it AND every track queued under it is an ND track. A failed
 * lookup rewrites nothing — the entry then behaves as it did before, which
 * is the outcome this migration is improving on, not one it can worsen.
 */
const ndPlaylistSourceRewrites = async (
  queue: readonly PersistedQueueItem[],
): Promise<ReadonlyMap<string, PlaylistId>> => {
  const allTracksAreNd = new Map<string, boolean>();

  for (const item of queue) {
    if (item.source.type !== "playlist") continue;
    const id = item.source.playlistId;
    if (sourceKindOfId(id) !== "local") continue;

    const isNd = sourceKindOfId(persistedTrackId(item.track)) === "nd";
    allTracksAreNd.set(id, (allTracksAreNd.get(id) ?? true) && isNd);
  }

  const rewrites = new Map<string, PlaylistId>();
  for (const [id, isNd] of allTracksAreNd) {
    if (!isNd) continue;
    try {
      const found = await unwrapResult(playlistRepository.findById(PlaylistId(id)));
      if (!found) rewrites.set(id, ndPlaylistId(id));
    }
    catch (error) {
      getLogger().warn(`[Queue] Playlist source migration skipped for ${id}: ${String(error)}`);
    }
  }

  return rewrites;
};

const migrateSource = (source: QueueSource, rewrites: ReadonlyMap<string, PlaylistId>): QueueSource => {
  if (source.type !== "playlist") return source;
  const rewritten = rewrites.get(source.playlistId);
  return rewritten ? { type: "playlist", playlistId: rewritten } : source;
};

const rehydrateQueueItem = (
  item: PersistedQueueItem,
  libraryTracksById: ReadonlyMap<Track["id"], PlayerTrack>,
  rewrites: ReadonlyMap<string, PlaylistId>,
): QueueItem | null => {
  if (item.track.kind === "library") {
    const track = libraryTracksById.get(item.track.trackId);
    if (!track) return null;
    return {
      id: item.id,
      track,
      source: migrateSource(item.source, rewrites),
      addedAt: item.addedAt,
      cover: migrateCover(item.cover),
    };
  }

  return {
    id: item.id,
    track: {
      ...item.track,
      cover: migrateCover(item.track.cover) ?? undefined,
      source: item.track.source.type === "url"
        ? { ...item.track.source, url: migrateProxyUrl(item.track.source.url) }
        : item.track.source,
    },
    source: migrateSource(item.source, rewrites),
    addedAt: item.addedAt,
    cover: migrateCover(item.cover),
  };
};

/**
 * Rebuilds the canonical state from a stored snapshot, reading the library
 * rows it references. Returns null when nothing in it can be restored
 * (every row deleted). Throws on an infrastructure failure (DB hiccup).
 */
export const rehydratePersistedQueue = async (
  snapshot: PersistedQueueSnapshot,
): Promise<QueueState | null> => {
  const libraryTrackIds = unique(snapshot.queue.flatMap((item) => {
    if (item.track.kind !== "library") return [];
    return [item.track.trackId];
  }));

  const libraryTracks = libraryTrackIds.length > 0
    ? await unwrapResult(trackRepository.findByIds(libraryTrackIds))
    : [];
  const libraryTracksById = new Map(libraryTracks.map(track => [track.id, mapTrackEntityToPlayerTrack(track)]));
  const playlistSourceRewrites = await ndPlaylistSourceRewrites(snapshot.queue);

  // In the snapshot's playback order; library rows gone from the DB drop out.
  const restoredQueue = snapshot.queue.flatMap((item) => {
    const restored = rehydrateQueueItem(item, libraryTracksById, playlistSourceRewrites);
    return restored ? [restored] : [];
  });

  if (restoredQueue.length === 0) return null;

  // Unshuffled, the playback order IS the original order. Shuffled, the
  // original order is what unshuffle returns to; an entry the stored
  // order forgot (older snapshots) is kept at the end rather than lost.
  let restoredItems = restoredQueue;
  if (snapshot.isShuffled) {
    const restoredIds = new Set(restoredQueue.map(item => item.id));
    const originalIds = snapshot.originalQueueOrder.filter(id => restoredIds.has(id));
    const ordered = new Set(originalIds);
    restoredItems = [
      ...getItemsByOrder(restoredQueue, originalIds),
      ...restoredQueue.filter(item => !ordered.has(item.id)),
    ];
  }

  // currentItemId survives library deletions that shorten the restored
  // queue; the positional index is only a fallback for older v1 snapshots.
  const positionalItem = snapshot.currentIndex >= 0
    ? snapshot.queue[snapshot.currentIndex] as PersistedQueueItem | undefined
    : undefined;
  const restoredCurrentId = snapshot.currentItemId ?? positionalItem?.id ?? null;

  return {
    items: restoredItems,
    playbackOrder: snapshot.isShuffled ? restoredQueue.map(item => item.id) : null,
    currentItemId: restoredCurrentId !== null && restoredQueue.some(item => item.id === restoredCurrentId)
      ? restoredCurrentId
      : null,
  };
};
