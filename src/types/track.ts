import type { AlbumEntity, ArtistEntity, PinnedFlag, TrackEntity, TrackSource, TrackState } from "@/db/entities";
import type { SourceTrackDTO } from "@/types/source-dto";
import type { AlbumId, ArtistId, TrackId } from "@/types/ids";

export interface TrackLoudnessMetadata {
  integratedLufs?: number;
  truePeakDbtp?: number;
  replayGainDb?: number;
  replayPeak?: number;
}

//
// Covers all storage sources via TrackSource enum:
//   LOCAL_INTERNAL -> file copied into app storage (OPFS web / internal Tauri)
//   LOCAL_EXTERNAL -> file on user FS, referenced by path (Tauri only)
//   REMOTE_HLS     -> HLS stream URL stored in DB (future: internet radio stations)
//
export interface Track extends TrackLoudnessMetadata {
  kind: "library";
  id: TrackId;
  title: string;
  artist: string;
  artistIds: ArtistId[];
  albumId: AlbumId;
  albumName: string;
  storagePath: string;
  source: TrackSource;
  state: TrackState;
  /** Absent only in legacy fixtures; entity rows always carry the flag. */
  pinned?: PinnedFlag;
  /**
   * Present on display VMs built from live source pages (ND browsing): the
   * original DTO. Menus open remote subjects from it and playback/queueing
   * shadow-pins it; the row itself is NOT in Dexie.
   */
  sourceDto?: SourceTrackDTO;
  duration: number;
  isLiked: boolean;
  playCount?: number;
  addedAt?: number;
  isExplicit?: boolean;
  trackNo?: number;
  diskNo?: number;
  lyricsPath?: string;
  lyricsFileName?: string;
  lyricsOffsetMs?: number;
}

//
// Discriminated union for the three ways an ephemeral track can provide audio.
//
export type EphemeralSource
  = | { type: "file"; file: File } // Web: drag-and-drop or file picker
    | { type: "path"; path: string } // Tauri: "Open with" / drag-and-drop native file
    | { type: "url"; url: string }; // Any: HLS radio, direct stream URL

// -- Ephemeral track (NOT in DB) ----------------------------------------------
//
// Temporary playback without importing into the library.
// Examples:
//   - Tauri "Open with" -> type: "path"
//   - Web drag-and-drop before import decision -> type: "file"
//   - Internet radio / ad-hoc HLS stream -> type: "url"
//
// Never persisted. Not tracked in stats. No likedAt / artistId / albumId.
//
export interface EphemeralTrack {
  kind: "ephemeral";
  id: string;
  title: string;
  artist?: string;
  albumName?: string;
  duration?: number;
  cover?: string;
  source: EphemeralSource;
  /**
   * Catalog DTO the row was built from (YT search/collection streams). The
   * stream itself needs none of it, but downloading pins the track, and
   * without the DTO's artist/album ids the copy lands in the library orphaned.
   */
  sourceDto?: SourceTrackDTO;
}

export type PlayerTrack = Track | EphemeralTrack;

export function isLibraryTrack(track: PlayerTrack | null): track is Track {
  return track !== null && track.kind === "library";
}

export function isEphemeralTrack(track: PlayerTrack | null): track is EphemeralTrack {
  return track !== null && track.kind === "ephemeral";
}

// -- Ephemeral track factories ------------------------------------------------

/** Web: file picked or dropped, not yet imported. */
export function ephemeralFromFile(file: File, cover?: string): EphemeralTrack {
  return {
    kind: "ephemeral",
    id: crypto.randomUUID(),
    title: file.name.replace(/\.[^.]+$/, ""),
    cover,
    source: { type: "file", file },
  };
}

/** Tauri: native file path from "Open with" or drag-and-drop. */
export function ephemeralFromPath(
  path: string,
  meta?: Pick<EphemeralTrack, "title" | "artist" | "albumName" | "duration" | "cover">,
): EphemeralTrack {
  const filename = path.split(/[\\/]/).pop() ?? path;
  return {
    kind: "ephemeral",
    id: crypto.randomUUID(),
    title: meta?.title ?? filename.replace(/\.[^.]+$/, ""),
    artist: meta?.artist,
    albumName: meta?.albumName,
    duration: meta?.duration,
    cover: meta?.cover,
    source: { type: "path", path },
  };
}

/** Any platform: HLS stream, internet radio, direct URL. */
export function ephemeralFromUrl(
  url: string,
  meta: Pick<EphemeralTrack, "title" | "artist" | "albumName" | "duration" | "cover">,
): EphemeralTrack {
  return {
    kind: "ephemeral",
    id: crypto.randomUUID(),
    title: meta.title,
    artist: meta.artist,
    albumName: meta.albumName,
    duration: meta.duration,
    cover: meta.cover,
    source: { type: "url", url },
  };
}

export const mapTrack = (
  entity: TrackEntity,
  artists: ArtistEntity[] = [],
  album: AlbumEntity | null | undefined = null,
): Track => {
  // A shadow row's ids are mostly links without a row; a caption built from
  // the rows that do exist would drop the other names.
  const artist = artists.length > 0 && artists.length === entity.artistIds.length
    ? artists.map(a => a.name).join(", ")
    : entity.artistName;

  return {
    kind: "library",
    id: entity.id,
    title: entity.title,
    artist,
    artistIds: entity.artistIds,
    albumId: entity.albumId,
    albumName: album?.title ?? entity.albumTitle,
    storagePath: entity.storagePath ?? "",
    source: entity.source,
    state: entity.state,
    pinned: entity.pinned,
    duration: entity.duration,
    isLiked: !!entity.likedAt,
    playCount: entity.playCount,
    addedAt: entity.addedAt,
    trackNo: entity.trackNo,
    diskNo: entity.diskNo,
    lyricsPath: entity.lyricsPath,
    lyricsFileName: entity.lyricsFileName,
    lyricsOffsetMs: entity.lyricsOffsetMs,
    integratedLufs: entity.integratedLufs,
    truePeakDbtp: entity.truePeakDbtp,
    replayGainDb: entity.replayGainDb,
    replayPeak: entity.replayPeak,
  };
};

export const mapTracks = (
  entities: TrackEntity[],
  artists: ArtistEntity[],
  albums: AlbumEntity[],
): Track[] => {
  const artistMap = new Map(artists.map(artist => [artist.id, artist]));
  const albumMap = new Map(albums.map(album => [album.id, album]));

  return entities.map((entity) => {
    const artistList = entity.artistIds.map(id => artistMap.get(id)).filter((a): a is ArtistEntity => !!a);
    const albumEntity = albumMap.get(entity.albumId) ?? null;
    return mapTrack(entity, artistList, albumEntity);
  });
};
