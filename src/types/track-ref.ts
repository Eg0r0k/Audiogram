import { TrackSource } from "@/db/entities";
import { AlbumId, ArtistId, PlaylistId, TrackId } from "./ids";

// "radio" — M6
export type SourceKind = "local" | "nd" | "yt" | "ym";

export type RemoteSourceKind = Exclude<SourceKind, "local">;

//
// Remote ids are branded composite strings ("nd:<songId>", "yt:<videoId>",
// "ym:<trackId>"); local ids stay unprefixed (existing UUIDs) so no FK
// migration is needed.
//
export type TrackRef
  = | { kind: "local" }
    | { kind: "nd"; songId: string }
    | { kind: "yt"; videoId: string }
    | { kind: "ym"; trackId: string };

const ND_PREFIX = "nd:";
const YT_PREFIX = "yt:";
const YM_PREFIX = "ym:";

export function parseTrackRef(id: TrackId): TrackRef {
  if (id.startsWith(ND_PREFIX)) return { kind: "nd", songId: id.slice(ND_PREFIX.length) };
  if (id.startsWith(YT_PREFIX)) return { kind: "yt", videoId: id.slice(YT_PREFIX.length) };
  if (id.startsWith(YM_PREFIX)) return { kind: "ym", trackId: id.slice(YM_PREFIX.length) };
  return { kind: "local" };
}

export const ndTrackId = (songId: string) => TrackId(`${ND_PREFIX}${songId}`);
export const ytTrackId = (videoId: string) => TrackId(`${YT_PREFIX}${videoId}`);
export const ndAlbumId = (albumId: string) => AlbumId(`${ND_PREFIX}${albumId}`);
export const ndArtistId = (artistId: string) => ArtistId(`${ND_PREFIX}${artistId}`);
export const ndPlaylistId = (playlistId: string) => PlaylistId(`${ND_PREFIX}${playlistId}`);
// M5: yt album/artist id spaces ("yt:MPREb_…" / "yt:UC…") — the pin cascade
// can hang shadow album/artist rows off downloaded YT tracks.
export const ytAlbumId = (browseId: string) => AlbumId(`${YT_PREFIX}${browseId}`);
export const ytArtistId = (channelId: string) => ArtistId(`${YT_PREFIX}${channelId}`);
export const ytPlaylistId = (listId: string) => PlaylistId(`${YT_PREFIX}${listId}`);
// Yandex ids are numeric per entity type; a playlist is addressed by its
// owner's uid and its kind together, so that pair is the raw id.
export const ymTrackId = (trackId: string | number) => TrackId(`${YM_PREFIX}${trackId}`);
export const ymAlbumId = (albumId: string | number) => AlbumId(`${YM_PREFIX}${albumId}`);
export const ymArtistId = (artistId: string | number) => ArtistId(`${YM_PREFIX}${artistId}`);
export const ymPlaylistId = (ownerUid: string | number, kind: string | number) =>
  PlaylistId(`${YM_PREFIX}${ownerUid}:${kind}`);

/** Source kind of any branded id string (track/album/artist/playlist). */
export const sourceKindOfId = (id: string): SourceKind => parseTrackRef(id as TrackId).kind;

/** The raw id the source knows the track by; null for a local ref. */
export const remoteIdOf = (ref: TrackRef): string | null => {
  switch (ref.kind) {
    case "nd": return ref.songId;
    case "yt": return ref.videoId;
    case "ym": return ref.trackId;
    case "local": return null;
  }
};

const REMOTE_TRACK_SOURCE: Record<RemoteSourceKind, TrackSource> = {
  nd: TrackSource.REMOTE_SUBSONIC,
  yt: TrackSource.REMOTE_YT,
  ym: TrackSource.REMOTE_YM,
};

/** The persisted `TrackSource` a pinned row of this source carries. */
export const remoteTrackSource = (kind: RemoteSourceKind): TrackSource => REMOTE_TRACK_SOURCE[kind];

const REMOTE_TRACK_SOURCES = new Set<TrackSource>(Object.values(REMOTE_TRACK_SOURCE));

/** Whether a persisted row belongs to a source provider (HLS radio does not). */
export const isRemoteTrackSource = (source: TrackSource): boolean => REMOTE_TRACK_SOURCES.has(source);
