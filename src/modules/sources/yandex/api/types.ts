import type { SourceErrorKind } from "@/types/source-dto";

//
// What crosses the Rust bridge for Yandex Music. The token never does: the
// frontend learns who is signed in, never how.
//

export interface YmAuthStatus {
  loggedIn: boolean;
  uid: number | null;
  hasPlus: boolean;
  displayName: string | null;
}

export interface YmDeviceCode {
  userCode: string;
  verificationUrl: string;
  /** Seconds until the code stops working. */
  expiresIn: number;
  /** Seconds between token polls (Rust does the polling). */
  interval: number;
}

/** `ym:auth` — how a sign-in progresses and how a session ends. */
export type YmAuthEvent
  = | { status: "pending" }
    | { status: "ok"; uid: number; hasPlus: boolean; displayName: string }
    | { status: "cancelled" }
    | { status: "codeExpired" }
    | { status: "expired" }
    | { status: "error"; message: string };

export interface YmRequestPayload {
  method?: "GET" | "POST";
  /** API path; `{uid}` is filled in on the Rust side. */
  path: string;
  query?: Record<string, string>;
  form?: Record<string, string>;
}

/** Every `ym_*` command rejects with this shape (serialized `YmError`). */
export interface YmError {
  kind: Extract<SourceErrorKind, "AUTH" | "FORBIDDEN" | "RATE_LIMITED" | "NOT_FOUND" | "NETWORK" | "UNAVAILABLE" | "CANCELLED" | "UNKNOWN">;
  message: string;
  retryAfterMs?: number;
}

//
// API shapes, as recorded in __fixtures__ (2026-09-15). Ids arrive as
// numbers or strings depending on the endpoint; every mapper stringifies.
// Cover URIs carry no scheme and a `%%` placeholder for the size.
//

export interface YmCover {
  uri?: string;
  /** Mosaic playlist covers list their tiles here instead of `uri`. */
  itemsUri?: string[];
  type?: string;
}

export interface YmArtist {
  /** Absent on credited-only names (compilations, unknown performers). */
  id?: number | string;
  name: string;
  various?: boolean;
  composer?: boolean;
  available?: boolean;
  cover?: YmCover;
  counts?: { tracks?: number; directAlbums?: number; alsoAlbums?: number; alsoTracks?: number };
}

export interface YmAlbum {
  id: number | string;
  title: string;
  version?: string;
  type?: string;
  year?: number;
  coverUri?: string;
  trackCount?: number;
  artists?: YmArtist[];
  available?: boolean;
  availableForPremiumUsers?: boolean;
  /** Discs, each in track order — only on `/albums/{id}/with-tracks`. */
  volumes?: YmTrack[][];
}

/** The album a track lists itself under, with the track's place on it. */
export interface YmTrackAlbum extends YmAlbum {
  trackPosition?: { volume: number; index: number };
}

export interface YmTrack {
  id: number | string;
  realId?: string;
  title: string;
  version?: string;
  /** False: region lock or takedown — nothing plays. */
  available?: boolean;
  availableForPremiumUsers?: boolean;
  /** True when the whole track plays without a subscription. */
  availableFullWithoutPermission?: boolean;
  durationMs?: number;
  previewDurationMs?: number;
  artists?: YmArtist[];
  albums?: YmTrackAlbum[];
  coverUri?: string;
  lyricsInfo?: { hasAvailableSyncLyrics?: boolean; hasAvailableTextLyrics?: boolean };
  type?: string;
}

export interface YmPlaylistOwner {
  uid: number;
  login?: string;
  name?: string;
}

export interface YmPlaylistTrack {
  id: number | string;
  originalIndex?: number;
  timestamp?: string;
  /** Absent in `/likes/playlists` listings; present on the playlist itself. */
  track?: YmTrack;
}

export interface YmPlaylist {
  uid?: number;
  kind: number;
  title: string;
  description?: string;
  trackCount: number;
  cover?: YmCover;
  owner?: YmPlaylistOwner;
  available?: boolean;
  visibility?: string;
  durationMs?: number;
  modified?: string;
  tracks?: YmPlaylistTrack[];
}

export interface YmSearchPage<T> {
  total: number;
  perPage: number;
  order?: number;
  results: T[];
}

export type YmSearchType = "all" | "track" | "album" | "artist" | "playlist";

export interface YmSearchResult {
  text?: string;
  misspellCorrected?: boolean;
  best?: { type: string; result: unknown };
  tracks?: YmSearchPage<YmTrack>;
  albums?: YmSearchPage<YmAlbum>;
  artists?: YmSearchPage<YmArtist>;
  playlists?: YmSearchPage<YmPlaylist>;
}

export interface YmPager {
  page: number;
  perPage: number;
  total: number;
}

/** `/artists/{id}/direct-albums` — the whole discography, paged. */
export interface YmArtistAlbumsPage {
  pager: YmPager;
  albums: YmAlbum[];
}

export interface YmArtistBriefInfo {
  artist: YmArtist;
  albums?: YmAlbum[];
  alsoAlbums?: YmAlbum[];
  popularTracks?: YmTrack[];
  playlists?: YmPlaylist[];
}

/** `/users/{uid}/likes/albums?rich=true` — the album rides inside the like. */
export interface YmLikedAlbum {
  id: string;
  timestamp?: string;
  album?: YmAlbum;
}

/** `/users/{uid}/likes/artists` — the artist rides inside the like. */
export interface YmLikedArtist {
  id?: string;
  timestamp?: string;
  artist?: YmArtist;
}

/** `/users/{uid}/likes/playlists` — the playlist rides inside the like. */
export interface YmLikedPlaylist {
  playlist?: YmPlaylist;
  timestamp?: string;
}

/** One entry of a station chain (`/rotor/station/{station}/tracks`). */
export interface YmStationSequenceItem {
  type?: string;
  track: YmTrack;
  liked?: boolean;
}

export interface YmStationTracks {
  id?: { type: string; tag: string };
  sequence: YmStationSequenceItem[];
  /** Names the chain in feedback (`batch-id`). */
  batchId?: string;
  pumpkin?: boolean;
}

export interface YmAccountStatus {
  account?: { uid?: number; login?: string; displayName?: string; fullName?: string };
  plus?: { hasPlus?: boolean };
}
