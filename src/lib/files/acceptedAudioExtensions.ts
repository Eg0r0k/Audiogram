import { platformCaps } from "@/lib/environment/platformCaps";

/**
 * Import accept-list, shared by drag-and-drop and the file picker.
 *
 * `.ape` (Monkey's Audio) needs the native media server's WAV transcoder —
 * no Chromium can decode it — so it is accepted only where that backend
 * exists (Tauri desktop/Android), never in the pure-web OPFS build.
 */
export const ACCEPTED_AUDIO_EXTENSIONS: readonly string[] = [
  ".mp3",
  ".flac",
  ".wav",
  ".ogg",
  ".m4a",
  ".aac",
  ".opus",
  ...(platformCaps.hasMediaServer ? [".ape"] : []),
];
