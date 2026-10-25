import { storageService } from "@/db/storage";
import { hasLyricsText, parseLyrics, type ParsedLyrics } from "../lib/lrc";
import { isLibraryTrack, type PlayerTrack, type Track } from "@/types/track";
import { fetchLrcLibLyrics } from "./lyrics.service";

export type LyricsSource = { type: "file"; fileName: string | null } | { type: "lrclib" };
export type LyricsFailure = "file-missing" | "network";
export type TrackLyricsLoadResult
  = | { status: "idle" }
    | { status: "ready"; lyrics: ParsedLyrics; raw: string; source: LyricsSource }
    | { status: "error"; reason: LyricsFailure };

const IDLE: TrackLyricsLoadResult = { status: "idle" };
const FILE_MISSING: TrackLyricsLoadResult = { status: "error", reason: "file-missing" };

const readAttachedText = async (lyricsPath: string): Promise<string | null> => {
  const file = await storageService.getFile(lyricsPath);
  if (file.isErr()) return null;
  try {
    return await file.value.text();
  }
  catch {
    return null;
  }
};

const loadAttachedLyrics = async (track: Track, lyricsPath: string): Promise<TrackLyricsLoadResult> => {
  const raw = await readAttachedText(lyricsPath);
  if (raw === null) return FILE_MISSING;

  const lyrics = parseLyrics(raw);
  if (!hasLyricsText(lyrics)) return IDLE;
  return { status: "ready", lyrics, raw, source: { type: "file", fileName: track.lyricsFileName ?? null } };
};

export const loadTrackLyrics = async (track: PlayerTrack | null): Promise<TrackLyricsLoadResult> => {
  if (!track) return IDLE;

  // Ephemeral tracks (YouTube streams, radio) have no lyricsPath, but a
  // title + artist is enough for the lrclib lookup below.
  if (isLibraryTrack(track) && track.lyricsPath) {
    return loadAttachedLyrics(track, track.lyricsPath);
  }

  if (!track.title || !track.artist) return IDLE;

  const result = await fetchLrcLibLyrics(track.title, track.artist);
  if (result.isOk()) {
    return { status: "ready", lyrics: result.value.lyrics, raw: result.value.raw, source: { type: "lrclib" } };
  }
  return result.error.type === "NETWORK" ? { status: "error", reason: "network" } : IDLE;
};
