import type { PlayerTrack } from "@/modules/player/types";

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
