export const VOLUME_STEP = 0.05;
export const SEEK_STEP = 5; // seconds
/** A seek or volume key held this long starts repeating its step. */
export const HOLD_DELAY_MS = 350;
/** One seek step per this interval while held: SEEK_STEP / SEEK_REPEAT_MS is ~33x playback. */
export const SEEK_REPEAT_MS = 150;
/** One volume step per this interval while held: silence to full in two seconds. */
export const VOLUME_REPEAT_MS = 100;
