import type { Result } from "neverthrow";
import type { StorageError } from "@/db/errors/storage.errors";
import type { SourceError } from "@/types/source-dto";
import type { PlayerTrack } from "@/types/track";

/**
 * Why playback could not start, as data. The store turns this into a
 * {@link PlaybackFailure} for callers that skip on failure (queue.store);
 * the kind is what lets them tell "skip this track" from "stop everything".
 */
export type PlaybackError
  = | { kind: "broken"; trackId: string }
    | { kind: "unavailable"; reason: string }
    | { kind: "storage"; cause: StorageError }
    | { kind: "source"; cause: SourceError }
    | { kind: "engine"; cause: Error }
    | { kind: "timeout"; phase: "resolving" | "loading" };

export class PlaybackFailure extends Error {
  constructor(
    public readonly error: PlaybackError,
    track: PlayerTrack,
  ) {
    super(describePlaybackError(error, track));
    this.name = "PlaybackFailure";
  }
}

export const describePlaybackError = (error: PlaybackError, track: PlayerTrack): string => {
  switch (error.kind) {
    case "broken": return `Track is marked as broken: "${track.title}"`;
    case "unavailable": return `Cannot resolve audio source for "${track.title}": ${error.reason}`;
    case "storage": return error.cause.message;
    case "source": return `[${error.cause.kind}] ${error.cause.message}`;
    case "engine": return error.cause.message;
    case "timeout": return `Timed out while ${error.phase} "${track.title}"`;
  }
};

/** Wraps whatever the engine threw so every failure leaving the store carries a kind. */
export const toPlaybackFailure = (thrown: unknown, track: PlayerTrack): PlaybackFailure => {
  if (thrown instanceof PlaybackFailure) return thrown;
  const cause = thrown instanceof Error ? thrown : new Error(String(thrown));
  return new PlaybackFailure({ kind: "engine", cause }, track);
};

/**
 * What the queue needs from whatever plays tracks. The player registers an
 * implementation at bootstrap (`initPlayerLifecycle`); the queue store never
 * imports the player store (ARCHITECTURE.md §3).
 */
export interface PlaybackPort {
  readonly currentTrack: PlayerTrack | null;
  readonly currentTime: number;
  readonly canSeek: boolean;
  readonly isPlaybackIntended: boolean;
  checkPlayable(track: PlayerTrack): Result<void, PlaybackError>;
  presentTrack(track: PlayerTrack): void;
  selectTrack(track: PlayerTrack): void;
  playPlayerTrack(track: PlayerTrack): Promise<void>;
  restartCurrent(): Promise<boolean>;
  stop(): void;
  clearCurrentTrack(): void;
  seekTo(seconds: number): void;
}

let port: PlaybackPort | null = null;

export const registerPlaybackPort = (next: PlaybackPort | null): void => {
  port = next;
};

export const playback = (): PlaybackPort => {
  if (!port) throw new Error("[Queue] PlaybackPort is not registered");
  return port;
};
