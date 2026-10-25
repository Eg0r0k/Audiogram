import { isEphemeralTrack, type EphemeralTrack, type PlayerTrack, type Track } from "@/types/track";
import type { SourceTrackDTO } from "@/modules/sources/types";
import { proxyPathFromUrl, trackIdFromStreamUrl } from "@/lib/stream-url";
import { parseTrackRef, type SourceKind } from "@/types/track-ref";

/** Source of a library track, derived from its (possibly prefixed) id. */
export function trackSourceKind(track: Track): SourceKind {
  return parseTrackRef(track.id).kind;
}

export function isRemoteTrack(track: Track): boolean {
  return trackSourceKind(track) !== "local";
}

/** True when the track's own file is on disk (remote rows keep this empty). */
export function trackHasLocalFile(track: Track): boolean {
  return track.storagePath.length > 0;
}

export function canDownloadTrack(track: Track | Track[]): boolean {
  if (Array.isArray(track)) return track.some(item => canDownloadTrack(item));
  return trackHasLocalFile(track);
}

export function trackHasLyrics(track: Track): boolean {
  return !!track.lyricsPath;
}

/**
 * Absolute file path of an "Open with" ephemeral track (desktop), null for
 * everything else — the gate for the "Import to library" CTA.
 */
export function ephemeralFilePath(track: PlayerTrack | null): string | null {
  if (!isEphemeralTrack(track) || track.source.type !== "path") return null;
  return track.source.path;
}

/**
 * A YouTube thumbnail proxied through the `ytimg/` route unwraps to the https
 * URL the catalog carries as coverRef; a plain URL already is one. Only
 * legacy snapshots reach this; their ND/YM covers are dropped on restore.
 */
const streamCoverRef = (cover: string | undefined): string | undefined => {
  if (!cover) return undefined;
  const route = proxyPathFromUrl(cover);
  if (route === null) return cover;
  return route.startsWith("ytimg/") ? route.slice("ytimg/".length) : undefined;
};

/**
 * The catalog identity of a playing stream: the DTO it was built from, or
 * one rebuilt from the proxied stream URL (queue entries that predate the
 * DTO). Null for files and non-proxied streams (radio) — those have nothing
 * to download or pin.
 */
export const ephemeralRemoteDto = (track: EphemeralTrack): SourceTrackDTO | null => {
  if (track.sourceDto) return track.sourceDto;
  if (track.source.type !== "url") return null;
  const id = trackIdFromStreamUrl(track.source.url);
  if (!id) return null;
  return {
    id,
    title: track.title,
    artistName: track.artist,
    albumTitle: track.albumName,
    duration: track.duration,
    coverRef: streamCoverRef(track.cover),
  };
};
