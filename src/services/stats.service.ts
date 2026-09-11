import { db } from "@/db";
import type { ListenOrigin, ListenPick } from "@/db/entities";
import { statsRepository } from "@/db/repositories/stats.repository";
import type { AlbumId, ArtistId, TrackId } from "@/types/ids";
import { createEventHook } from "@vueuse/core";
import { getLogger } from "@/lib/logger";

const MIN_LISTEN_SECONDS = 10;
const COMPLETE_THRESHOLD = 0.8;
/**
 * A track transition writes twice (the finished event, the started one); the
 * listeners re-read every listen event on each notification, so playback
 * notifications are coalesced into one trailing tick.
 */
export const STATS_NOTIFY_DELAY_MS = 300;

class StatsService {
  // Stats-query invalidation subscribes here (main.ts); the service itself
  // must not touch the query cache.
  private readonly _changed = createEventHook<void>();
  readonly onChange = this._changed.on;
  /**
   * Fires synchronously as a listen event is written, before the write
   * settles — unlike the debounced `onChange`. The queue asks for autoplay
   * picks in the same tick the ended track's event is recorded, and the
   * recommender must not answer from a snapshot that lacks it.
   */
  private readonly _listenRecorded = createEventHook<void>();
  readonly onListenRecorded = this._listenRecorded.on;
  private _notifyTimer: ReturnType<typeof setTimeout> | null = null;

  private _notifyLater(): void {
    if (this._notifyTimer) clearTimeout(this._notifyTimer);
    this._notifyTimer = setTimeout(() => {
      this._notifyTimer = null;
      this._changed.trigger().catch(error => getLogger().error(`[Stats] Change hook failed: ${String(error)}`));
    }, STATS_NOTIFY_DELAY_MS);
  }

  /** A user edit is one write and is awaited by its caller: notify at once. */
  private async _notifyNow(): Promise<void> {
    if (this._notifyTimer) clearTimeout(this._notifyTimer);
    this._notifyTimer = null;
    await this._changed.trigger();
  }

  private _pendingEvent: {
    eventId: string;
    trackId: TrackId;
    artistId: ArtistId;
    albumId: AlbumId;
    startedAt: number;
    trackDuration: number;
    origin: ListenOrigin;
  } | null = null;

  private async _finalizePending(
    secondsListened: number,
    skipped: boolean,
    completed = false,
  ): Promise<void> {
    const pending = this._pendingEvent;
    this._pendingEvent = null;
    if (!pending) return;

    const isCompleted = completed
      || (pending.trackDuration > 0
        && secondsListened / pending.trackDuration >= COMPLETE_THRESHOLD);
    // An interruption past the complete threshold is a finished listen, not
    // a skip — mirroring scrobbling conventions.
    const isSkipped = skipped && !isCompleted;

    this._listenRecorded.trigger().catch(error => getLogger().error(`[Stats] Listen hook failed: ${String(error)}`));
    await db.listenEvents.update(pending.eventId, {
      secondsListened,
      completed: isCompleted,
      skipped: isSkipped,
    });

    if (!isSkipped && secondsListened >= MIN_LISTEN_SECONDS) {
      // Read-modify-write inside one modify() so a concurrent writer cannot
      // clobber the increment.
      db.tracks
        .where("id")
        .equals(pending.trackId)
        .modify((track) => {
          track.playCount += 1;
          track.lastPlayedAt = pending.startedAt;
        })
        .catch(error => getLogger().error(`[Stats] Play count update failed for ${pending.trackId}: ${String(error)}`));
    }

    this._notifyLater();
  }

  startListening(
    trackId: TrackId,
    artistId: ArtistId,
    albumId: AlbumId,
    trackDuration: number,
    origin: ListenOrigin,
    pick?: ListenPick,
  ): void {
    if (this._pendingEvent) {
      this._finalizePending(0, true).catch(error => getLogger().error(`[Stats] Finalizing pending event failed: ${String(error)}`));
    }

    const eventId = crypto.randomUUID();
    const now = Date.now();

    db.listenEvents.add({
      id: eventId,
      trackId,
      artistId,
      albumId,
      startedAt: now,
      secondsListened: 0,
      trackDuration,
      completed: false,
      skipped: false,
      origin,
      ...(pick ? { pick } : {}),
    }).then(() => this._notifyLater()).catch(error => getLogger().error(`[Stats] Recording listen event for ${trackId} failed: ${String(error)}`));

    this._pendingEvent = {
      eventId,
      trackId,
      artistId,
      albumId,
      startedAt: now,
      trackDuration,
      origin,
    };
  }

  stopListening(
    secondsListened: number,
    options: { completed?: boolean; skipped?: boolean } = {},
  ): Promise<void> {
    if (!this._pendingEvent) return Promise.resolve();
    return this._finalizePending(secondsListened, options.skipped ?? false, options.completed ?? false);
  }

  async removeFromHistory(trackId: TrackId): Promise<void> {
    const result = await statsRepository.deleteEventsForTrack(trackId);
    if (result.isErr()) throw result.error;
    await this._notifyNow();
  }

  async clearHistory(): Promise<void> {
    const result = await statsRepository.deleteAllEvents();
    if (result.isErr()) throw result.error;
    await this._notifyNow();
  }
}
export const statsService = new StatsService();
