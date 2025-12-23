export const REPEAT_MODES = ["off", "all", "one"] as const;
export type RepeatMode = typeof REPEAT_MODES[number];

export type PlaybackStatus
  = "idle"
    | "loading"
    | "playing"
    | "paused"
    | "buffering"
    | "error";
