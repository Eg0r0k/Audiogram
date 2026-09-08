import type { ListenEventEntity, ListenOrigin } from "@/db/entities";
import type { ArtistId, TrackId } from "@/types/ids";

export interface SessionEvent {
  trackId: TrackId;
  artistId: ArtistId;
  startedAt: number;
  skipped: boolean;
  completed: boolean;
  origin: ListenOrigin;
  secondsListened: number;
}

export type Session = SessionEvent[];

const toSessionEvent = (e: ListenEventEntity): SessionEvent => ({
  trackId: e.trackId,
  artistId: e.artistId,
  startedAt: e.startedAt,
  skipped: e.skipped,
  completed: e.completed,
  origin: e.origin,
  secondsListened: e.secondsListened,
});

export const buildSessions = (
  events: readonly ListenEventEntity[],
  gapMs: number,
  minLength = 2,
): Session[] => {
  const sorted = [...events].sort((a, b) => a.startedAt - b.startedAt);

  const rawSessions: Session[] = [];
  let current: Session = [];
  let prevStartedAt: number | null = null;
  for (const e of sorted) {
    if (prevStartedAt !== null && e.startedAt - prevStartedAt > gapMs) {
      rawSessions.push(current);
      current = [];
    }
    current.push(toSessionEvent(e));
    prevStartedAt = e.startedAt;
  }
  if (current.length > 0) rawSessions.push(current);

  const sessions: Session[] = [];
  for (const raw of rawSessions) {
    const collapsed: Session = [];
    let prevTrackId: TrackId | null = null;
    for (const se of raw) {
      if (se.trackId === prevTrackId) continue;
      collapsed.push(se);
      prevTrackId = se.trackId;
    }
    if (collapsed.length >= minLength) sessions.push(collapsed);
  }
  return sessions;
};
