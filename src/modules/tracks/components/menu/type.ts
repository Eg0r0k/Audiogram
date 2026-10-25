import type { ArtistId, PlaylistId } from "@/types/ids";
import type { EphemeralTrack, PlayerTrack, Track } from "@/types/track";
import type { SourceTrackDTO } from "@/modules/sources";

// A context names WHERE the menu is mounted, not what it shows: the YT search
// overlay and a YT page behind it can be open at the same time, so
// "yt-search" is its own target even though both serve catalog rows through
// the default context. Likewise "search-top" is the best-result row above the
// "search" track section.
export const TRACK_CONTEXTS = ["default", "current-track", "queue", "playlist", "album", "search", "search-top", "history", "liked", "artist", "yt-search"] as const;

export type TrackContext = (typeof TRACK_CONTEXTS)[number];

//
// What the menu is open FOR. Menus serve not only library tracks but also
// not-yet-pinned DTOs from live source pages (ND browsing, YT search) and
// ephemeral tracks (open-with, current YT stream).
//
export type TrackMenuSubject
  = | { kind: "library"; track: Track }
    | { kind: "remote"; dto: SourceTrackDTO }
    | { kind: "ephemeral"; track: EphemeralTrack };

/** Adapter for the existing PlayerTrack call sites — they stay unchanged. */
export function toTrackMenuSubject(track: PlayerTrack): TrackMenuSubject {
  if (track.kind === "library") {
    // Display VMs from live source pages carry their DTO — the menu acts on
    // the remote subject, not on a Dexie row that does not exist.
    return track.sourceDto
      ? { kind: "remote", dto: track.sourceDto }
      : { kind: "library", track };
  }
  return { kind: "ephemeral", track };
}

/** Subjects wrap their payload — unlike tracks/DTOs they carry no own id. */
export function isTrackMenuSubject(value: PlayerTrack | TrackMenuSubject): value is TrackMenuSubject {
  return !("id" in value);
}

export function trackMenuSubjectId(subject: TrackMenuSubject | null): string | null {
  if (!subject) return null;
  return subject.kind === "remote" ? subject.dto.id : subject.track.id;
}

export interface ContextActions {
  play: () => void;
  playNext: () => void;
  addToQueue: () => void;
  showDetails: () => void;
  showLyrics: () => void;
  toggleLike: () => void;
  attachLyrics: () => void;
  addToPlaylist: (playlistId: PlaylistId) => void;
  removeFromQueue?: () => void;
  removeFromPlaylist?: () => void;
  removeFromHistory?: () => void;
  goToArtist: (artistId: ArtistId) => void;
  goToAlbum: () => void;
  /** "Save as…" — exports the local file or the downloaded copy to user disk. */
  exportFile: () => void;
  /** Queues an offline download (pins the subject — download = membership). */
  downloadOffline: () => void;
  /** Cancels the track's queued/running download job. */
  cancelOfflineDownload: () => void;
  /** Deletes the downloaded local copy (row + file); the remote row streams live again. */
  removeDownload: () => void;
  /** Pins a remote subject with pinned = 1 (or upgrades a shadow row). */
  addToLibrary: () => void;
  /** Degrades a remote row to shadow: playlists/like cascade. */
  removeFromLibrary: () => void;
  /** Opens the track's page at its source (yt/nd) via plugin-opener. */
  openExternal: () => void;
}

export type TrackMenuActions = ContextActions & {
  importToLibrary: () => Promise<void>;
};
