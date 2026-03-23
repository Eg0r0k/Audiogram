import { db } from "@/db";
import { ListenEventEntity } from "@/db/entities";
import { trackRepository } from "@/db/repositories";
import { AlbumId, ArtistId, TrackId } from "@/types/ids";

const MIN_LISTEN_SECONDS = 10;
const COMPLETE_THRESHOLD = 0.8; // 80%

class StatsService {
  private _pendingEvent: {
    trackId: TrackId;
    artistId: ArtistId;
    albumId: AlbumId;
    startedAt: number;
    trackDuration: number;
  } | null = null;

  private async _flush(secondsListened: number, skipped: boolean, completed = false) {
    const pending = this._pendingEvent;
    this._pendingEvent = null;
    if (!pending) return;
    if (!skipped && secondsListened < MIN_LISTEN_SECONDS) return;
    const isCompleted = completed
      || (pending.trackDuration > 0
        && secondsListened / pending.trackDuration >= COMPLETE_THRESHOLD);

    const event: ListenEventEntity = {
      id: crypto.randomUUID(),
      trackId: pending.trackId,
      artistId: pending.artistId,
      albumId: pending.albumId,
      startedAt: pending.startedAt,
      secondsListened,
      trackDuration: pending.trackDuration,
      completed: isCompleted,
      skipped,
    };

    db.listenEvents.add(event).catch(console.error);
    if (!skipped) {
      trackRepository.update(pending.trackId, {
        playCount: (await db.tracks.get(pending.trackId))?.playCount ?? 0 + 1,
        lastPlayedAt: pending.startedAt,
      }).catch(console.error);
    }
  };

  startListening(
    trackId: TrackId,
    artistId: ArtistId,
    albumId: AlbumId,
    trackDuration: number,
  ): void {
    if (this._pendingEvent) {
      this._flush(0, true);
    }

    this._pendingEvent = {
      trackId,
      artistId,
      albumId,
      startedAt: Date.now(),
      trackDuration,
    };
  }

  stopListening(secondsListened: number, completed = false): void {
    if (!this._pendingEvent) return;
    this._flush(secondsListened, false, completed);
  }
}
export const statsService = new StatsService();
