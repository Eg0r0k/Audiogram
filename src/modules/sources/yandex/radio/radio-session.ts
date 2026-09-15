import { errAsync, type ResultAsync } from "neverthrow";
import { useEventBus } from "@vueuse/core";
import { listenEndedEvent, trackChangedEvent, type ListenEndedPayload } from "@/modules/player/lib/player-events";
import type { PlayerTrack } from "@/modules/player/types";
import type { RadioSession } from "@/modules/queue/lib/queue-radio";
import { getLogger } from "@/lib/logger";
import type { SourceError, SourceTrackDTO } from "@/types/source-dto";
import { parseTrackRef } from "@/types/track-ref";
import type { TrackId } from "@/types/ids";
import { ymApi } from "../api/client";
import type { YmStationTracks } from "../api/types";
import { mapYmTrack } from "../mappers";
import { ymSourceProvider } from "../provider";

//
// "My Wave" and the other rotor stations. A session is a chain of tracks
// plus the feedback loop Yandex trains the station on: it hears each
// track start and end from the player and reports it under the batch the
// track came in. Feedback is fire-and-forget with a short retry; it must
// never hold the queue up.
//

export const MY_WAVE_STATION = "user:onyourwave";

const MAX_FEEDBACK_ATTEMPTS = 3;
/** Chains arrive ~5 long; warming two keeps the transition inside the wave gapless. */
const PREFETCH_AHEAD = 2;

export interface RadioDeps {
  stationTracks: (station: string, queue?: string) => ResultAsync<YmStationTracks, SourceError>;
  stationFeedback: (station: string, batchId: string | null, form: Record<string, string>) => ResultAsync<unknown, SourceError>;
  prefetch: (id: TrackId) => void;
  now: () => Date;
}

const defaultDeps: RadioDeps = {
  stationTracks: ymApi.stationTracks,
  stationFeedback: ymApi.stationFeedback,
  prefetch: (id) => {
    ymSourceProvider.prefetch?.(id)
      .match(
        () => {},
        error => getLogger().warn(`[YM radio] Prefetch of ${id} failed: ${error.message}`),
      )
      .catch(() => {});
  },
  now: () => new Date(),
};

interface PendingFeedback {
  batchId: string | null;
  form: Record<string, string>;
  attempts: number;
}

const rawIdOf = (id: TrackId): string | null => {
  const ref = parseTrackRef(id);
  return ref.kind === "ym" ? ref.trackId : null;
};

export const createYmRadioSession = (station: string = MY_WAVE_STATION, deps: RadioDeps = defaultDeps): RadioSession => {
  let stopped = false;
  let currentBatch: string | null = null;
  let lastTrackId: string | null = null;
  /** Which chain each track came in — feedback names that chain. */
  const batchOf = new Map<TrackId, string | null>();
  const pending: PendingFeedback[] = [];
  let flushing = false;
  const unsubscribers: (() => void)[] = [];

  const flush = (): void => {
    if (flushing || stopped || pending.length === 0) return;
    const next = pending[0];
    flushing = true;
    deps.stationFeedback(station, next.batchId, next.form)
      .match(
        () => {
          pending.shift();
          return true;
        },
        (error) => {
          next.attempts += 1;
          getLogger().warn(`[YM radio] Feedback ${next.form.type} failed (${error.kind}): ${error.message}`);
          if (next.attempts >= MAX_FEEDBACK_ATTEMPTS) pending.shift();
          // A failed send waits for the next trigger rather than looping.
          return false;
        },
      )
      .then((sent) => {
        flushing = false;
        if (sent) flush();
      })
      .catch(() => {
        flushing = false;
      });
  };

  const send = (form: Record<string, string>, track?: TrackId): void => {
    if (stopped) return;
    pending.push({
      batchId: track ? batchOf.get(track) ?? currentBatch : currentBatch,
      form: { ...form, timestamp: deps.now().toISOString() },
      attempts: 0,
    });
    flush();
  };

  const onStarted = (track: PlayerTrack | null): void => {
    if (!track || !batchOf.has(track.id as TrackId)) return;
    const raw = rawIdOf(track.id as TrackId);
    if (raw) send({ type: "trackStarted", trackId: raw }, track.id as TrackId);
  };

  const onEnded = ({ track, seconds, reason }: ListenEndedPayload): void => {
    if (!batchOf.has(track.id as TrackId)) return;
    const raw = rawIdOf(track.id as TrackId);
    if (!raw) return;
    send({
      type: reason === "completed" ? "trackFinished" : "skip",
      trackId: raw,
      totalPlayedSeconds: String(Math.round(seconds)),
    }, track.id as TrackId);
  };

  const fetchChain = (queue: string | undefined): ResultAsync<SourceTrackDTO[], SourceError> =>
    deps.stationTracks(station, queue).map((result) => {
      currentBatch = result.batchId ?? null;
      if (result.sequence.length > 0) {
        lastTrackId = String(result.sequence[result.sequence.length - 1].track.id);
      }
      // Yandex may hand a locked track to a station; it never reaches the queue.
      const tracks = result.sequence
        .map(item => mapYmTrack(item.track))
        .filter(dto => dto.availability !== "unavailable");
      for (const dto of tracks) batchOf.set(dto.id, currentBatch);
      for (const dto of tracks.slice(0, PREFETCH_AHEAD)) deps.prefetch(dto.id);
      return tracks;
    });

  const ended = (): ResultAsync<never, SourceError> =>
    errAsync({ kind: "CANCELLED", message: "the station session has ended" });

  return {
    station,

    start() {
      if (stopped) return ended();
      unsubscribers.push(
        useEventBus(trackChangedEvent).on(onStarted),
        useEventBus(listenEndedEvent).on(onEnded),
      );
      return fetchChain(undefined).map((tracks) => {
        send({ type: "radioStarted" });
        return tracks;
      });
    },

    next() {
      if (stopped) return ended();
      return fetchChain(lastTrackId ?? undefined);
    },

    stop() {
      if (stopped) return;
      stopped = true;
      for (const unsubscribe of unsubscribers.splice(0)) unsubscribe();
      pending.length = 0;
    },
  };
};
