import { COMMANDS, invokeCommand } from "@/app/tauri-commands";

export type ThumbbarAction = "like" | "previous" | "play-pause" | "next";

export interface ThumbbarState {
  hasTrack: boolean;
  playing: boolean;
  liked: boolean;
  canLike: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  tooltips: {
    like: string;
    unlike: string;
    previous: string;
    play: string;
    pause: string;
    next: string;
  };
}

/** Mirrors the player state into the Windows taskbar thumbnail toolbar. */
export const setThumbbarState = (state: ThumbbarState): Promise<void> =>
  invokeCommand(COMMANDS.thumbbarSetState, { state });
