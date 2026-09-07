import { db } from "@/db";
import type { ListenEventEntity } from "@/db/entities";
import { deduplicate } from "@/lib/math";
import type { ArtistId, TrackId } from "@/types/ids";
import { SESSION_GAP_MS } from "@/db/repositories/stats.repository";

const MIN_SESSION_LENGTH = 2;
export const MAX_HISTORY_DAYS = 90;

export type Session = TrackId[];

export interface CoOccurrence<Id> {
  raw: Map<Id, Map<Id, number>>;
  sessionCounts: Map<Id, number>;
}

export const groupSessions = (events: ListenEventEntity[]): ListenEventEntity[][] => {
  const sorted = events
    .filter(e => !e.skipped)
    .sort((a, b) => a.startedAt - b.startedAt);
  if (sorted.length === 0) return [];

  const groups: ListenEventEntity[][] = [];
  let current: ListenEventEntity[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startedAt - sorted[i - 1].startedAt > SESSION_GAP_MS) {
      if (current.length >= MIN_SESSION_LENGTH) groups.push(current);
      current = [sorted[i]];
    }
    else {
      current.push(sorted[i]);
    }
  }
  if (current.length >= MIN_SESSION_LENGTH) groups.push(current);
  return groups;
};

export const toTrackSessions = (groups: ListenEventEntity[][]): Session[] =>
  groups.map(g => deduplicate(g.map(e => e.trackId)));

export const toArtistSessions = (groups: ListenEventEntity[][]): ArtistId[][] =>
  groups.map(g => deduplicate(g.map(e => e.artistId)));

export const buildCoOccurrence = <Id>(sessions: Id[][]): CoOccurrence<Id> => {
  const raw = new Map<Id, Map<Id, number>>();
  const sessionCounts = new Map<Id, number>();

  for (const session of sessions) {
    const unique = [...new Set(session)];
    for (const id of unique) {
      sessionCounts.set(id, (sessionCounts.get(id) ?? 0) + 1);
    }
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const a = unique[i];
        const b = unique[j];
        let aMap = raw.get(a);
        if (!aMap) {
          aMap = new Map();
          raw.set(a, aMap);
        }
        let bMap = raw.get(b);
        if (!bMap) {
          bMap = new Map();
          raw.set(b, bMap);
        }
        aMap.set(b, (aMap.get(b) ?? 0) + 1);
        bMap.set(a, (bMap.get(a) ?? 0) + 1);
      }
    }
  }
  return { raw, sessionCounts };
};

export async function buildSessions(): Promise<Session[]> {
  const since = Date.now() - MAX_HISTORY_DAYS * 86_400_000;
  const events = await db.listenEvents
    .where("startedAt")
    .aboveOrEqual(since)
    .toArray();
  return toTrackSessions(groupSessions(events));
}

export function buildCoOccurrenceMatrix(
  sessions: Session[],
): Map<TrackId, Map<TrackId, number>> {
  const { raw, sessionCounts } = buildCoOccurrence(sessions);
  const normalized = new Map<TrackId, Map<TrackId, number>>();
  for (const [a, bMap] of raw) {
    const normBMap = new Map<TrackId, number>();
    const countA = sessionCounts.get(a) ?? 1;
    for (const [b, count] of bMap) {
      normBMap.set(b, count / Math.sqrt(countA * (sessionCounts.get(b) ?? 1)));
    }
    normalized.set(a, normBMap);
  }
  return normalized;
}
