import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { Channel } from "@tauri-apps/api/core";
import { COMMANDS, invokeCommand } from "@/app/tauri-commands";
import { ymCoverUrl, ymTrackStreamUrl } from "@/lib/stream-url";
import { parseTrackRef } from "@/types/track-ref";
import type { AlbumId, ArtistId, PlaylistId, TrackId } from "@/types/ids";
import type {
  DownloadEvent,
  SourceAlbumDTO,
  SourceArtistDTO,
  SourceError,
  SourcePlaylistDTO,
  SourceProvider,
  SourceSearchHit,
  SourceSearchScope,
} from "../types";
import { mapYmError, ymApi } from "./api/client";
import type {
  YmAlbum,
  YmArtist,
  YmLikedAlbum,
  YmLikedArtist,
  YmLikedPlaylist,
  YmPlaylist,
  YmSearchResult,
  YmTrack,
} from "./api/types";
import { isYmAvailable, setYmHasPlus } from "./config";
import { useYmAuthStore } from "./store/ym-auth.store";
import {
  flattenAlbumTracks,
  mapYmAlbum,
  mapYmArtist,
  mapYmPlaylist,
  mapYmTrack,
  playlistTracks,
  ymPlaylistOwnerUid,
} from "./mappers";

const unavailable = <T>(): ResultAsync<T, SourceError> =>
  errAsync<T, SourceError>({ kind: "UNAVAILABLE", message: "Yandex Music is not signed in" });

const notYm = <T>(what: string, id: string): ResultAsync<T, SourceError> =>
  errAsync<T, SourceError>({ kind: "PARSE", message: `Not a Yandex Music ${what} id: ${id}` });

/** The raw Yandex id behind any ym-prefixed branded id. */
const ymIdOf = (id: TrackId | AlbumId | ArtistId | PlaylistId): string | null => {
  const ref = parseTrackRef(id as TrackId);
  return ref.kind === "ym" ? ref.trackId : null;
};

/** A playlist id is `ym:<ownerUid>:<kind>`. */
const ymPlaylistRef = (id: PlaylistId): { owner: string; kind: string } | null => {
  const raw = ymIdOf(id);
  const [owner, kind, ...rest] = raw?.split(":") ?? [];
  if (!owner || !kind || rest.length > 0) return null;
  return { owner, kind };
};

const withSession = <T>(call: () => ResultAsync<T, SourceError>): ResultAsync<T, SourceError> =>
  (isYmAvailable() ? call() : unavailable<T>());

/** Yandex refuses `page >= 100`; the tail past that is simply not offered. */
const MAX_SEARCH_PAGE = 99;
/** Discography page size; a page cap keeps a pathological artist from turning into hundreds of round-trips. */
const ARTIST_ALBUMS_PAGE_SIZE = 200;
const MAX_ARTIST_ALBUM_PAGES = 10;

/** Walks the discography until the pager says it is complete or the page cap is hit. */
const collectArtistAlbums = (
  artistId: string,
  loaded: YmAlbum[],
  page: number,
): ResultAsync<YmAlbum[], SourceError> =>
  ymApi.artistAlbums(artistId, page, ARTIST_ALBUMS_PAGE_SIZE).andThen((result) => {
    const albums = [...loaded, ...result.albums];
    const done = result.albums.length === 0 || albums.length >= result.pager.total;
    if (done || page + 1 >= MAX_ARTIST_ALBUM_PAGES) return okAsync(albums);
    return collectArtistAlbums(artistId, albums, page + 1);
  });
/** The likes playlist: every account has it under this kind. */
const LIKES_PLAYLIST_KIND = "3";

// The likes endpoints wrap their entity in a like ({album, timestamp}) or
// hand it over bare — recorded: artists come bare. Both are accepted.
const likedAlbumOf = (row: YmLikedAlbum | YmAlbum): { album: YmAlbum; likedAt: string } | null => {
  if ("title" in row) return { album: row, likedAt: "" };
  return row.album ? { album: row.album, likedAt: row.timestamp ?? "" } : null;
};

/** Liked albums arrive whole; the sort is ours, the paging is one page. */
const sortAlbums = (likes: (YmLikedAlbum | YmAlbum)[], sort: "alpha" | "newest") => {
  const rows = likes.flatMap(row => likedAlbumOf(row) ?? []);
  if (sort === "newest") rows.sort((a, b) => b.likedAt.localeCompare(a.likedAt));
  else rows.sort((a, b) => a.album.title.localeCompare(b.album.title));
  return rows.map(row => row.album);
};

const artistsOf = (rows: (YmArtist | YmLikedArtist)[]): SourceArtistDTO[] =>
  rows.flatMap((row) => {
    const artist = "name" in row ? row : row.artist;
    const mapped = artist ? mapYmArtist(artist) : null;
    return mapped ? [mapped] : [];
  });

const likedPlaylistOf = (row: YmLikedPlaylist | YmPlaylist): YmPlaylist[] => {
  if ("kind" in row) return [row];
  return row.playlist ? [row.playlist] : [];
};

const uniquePlaylists = (lists: YmPlaylist[][]): SourcePlaylistDTO[] => {
  const seen = new Set<string>();
  return lists.flat().flatMap((playlist) => {
    const dto = mapYmPlaylist(playlist);
    if (seen.has(dto.id)) return [];
    seen.add(dto.id);
    return [dto];
  });
};

const SEARCH_TYPE: Record<SourceSearchScope, "all" | "track" | "album" | "artist" | "playlist"> = {
  all: "all",
  track: "track",
  album: "album",
  artist: "artist",
  playlist: "playlist",
};

const hitsOf = (result: YmSearchResult): SourceSearchHit[] => [
  ...(result.tracks?.results ?? []).map((track): SourceSearchHit => ({ kind: "track", item: mapYmTrack(track) })),
  ...(result.albums?.results ?? []).map((album): SourceSearchHit => ({ kind: "album", item: mapYmAlbum(album) })),
  ...artistsOf(result.artists?.results ?? []).map((item): SourceSearchHit => ({ kind: "artist", item })),
  ...(result.playlists?.results ?? []).map((playlist): SourceSearchHit => ({ kind: "playlist", item: mapYmPlaylist(playlist) })),
];

/** Whether any section of this page has more pages after `page`. */
const hasMore = (result: YmSearchResult, page: number): boolean => {
  if (page >= MAX_SEARCH_PAGE) return false;
  return [result.tracks, result.albums, result.artists, result.playlists]
    .some(section => section && section.results.length > 0 && (page + 1) * section.perPage < section.total);
};

export const ymSourceProvider: SourceProvider = {
  id: "ym",

  // Downloads are offered to every account; whether Yandex hands over a
  // whole track or only a preview is decided per track when it is asked for
  // (the Plus flag alone cannot tell — see ymAvailability).
  capabilities: {
    artists: { list: true, open: true },
    albums: { list: true, open: true },
    playlists: { list: true, open: true },
    search: true,
    download: true,
  },

  get isAvailable() {
    return isYmAvailable();
  },

  // Resolving a stream is two round-trips to Yandex plus a redirect.
  resolveTimeoutMs: 30_000,

  // Search is rate-limited per IP; as-you-type would spend the budget on
  // every keystroke.
  searchMode: "submit",

  externalUrl({ id, albumId }) {
    const trackId = ymIdOf(id);
    if (!trackId) return null;
    const album = albumId ? ymIdOf(albumId) : null;
    return album
      ? `https://music.yandex.ru/album/${album}/track/${trackId}`
      : `https://music.yandex.ru/track/${trackId}`;
  },

  /** From the like list loaded at sign-in; a store that is not up knows no likes. */
  isTrackLiked(id) {
    const trackId = ymIdOf(id);
    if (!trackId) return false;
    try {
      return useYmAuthStore().likedTrackIds.has(trackId);
    }
    catch {
      return false;
    }
  },

  /** Yandex first, then the store: a refused like leaves the heart as it was. */
  setTrackLiked(id, liked) {
    const trackId = ymIdOf(id);
    if (!trackId) return notYm("track", id);
    if (!isYmAvailable()) return unavailable<void>();
    const call = liked ? ymApi.likeTracks([trackId]) : ymApi.unlikeTracks([trackId]);
    return call.map(() => {
      useYmAuthStore().markTrackLiked(trackId, liked);
    });
  },

  /** The cheapest authenticated call; it also refreshes whether the account has Plus. */
  checkConnection() {
    if (!isYmAvailable()) return unavailable<void>();
    return ymApi.accountStatus().andThen((status) => {
      if (status.account?.uid === undefined) {
        return errAsync<void, SourceError>({ kind: "AUTH", message: "the session names no account" });
      }
      setYmHasPlus(status.plus?.hasPlus ?? false);
      return okAsync(undefined);
    });
  },

  listArtists() {
    return withSession(() => ymApi.likedArtists().map(artistsOf));
  },

  listAlbums(p) {
    // Likes arrive whole and unsorted; the first page is the whole list and
    // any later page is empty — the infinite query stops on a short page.
    if (p.offset > 0) return okAsync<SourceAlbumDTO[], SourceError>([]);
    return withSession(() =>
      ymApi.likedAlbums().map(likes => sortAlbums(likes, p.sort).map(mapYmAlbum)),
    );
  },

  getAlbum(id) {
    const albumId = ymIdOf(id);
    if (!albumId) return notYm("album", id);
    return withSession(() =>
      ymApi.album(albumId).map(album => ({
        album: mapYmAlbum(album),
        tracks: flattenAlbumTracks(album),
      })),
    );
  },

  /** brief-info for the artist and the popular tracks; the discography comes whole from direct-albums. */
  getArtist(id) {
    const artistId = ymIdOf(id);
    if (!artistId) return notYm("artist", id);
    return withSession(() =>
      ResultAsync.combine([ymApi.artist(artistId), collectArtistAlbums(artistId, [], 0)]).andThen(([info, albums]) => {
        const artist = mapYmArtist(info.artist) ?? mapYmArtist({ ...info.artist, id: artistId });
        if (!artist) return errAsync<never, SourceError>({ kind: "PARSE", message: "brief-info returned no artist" });
        return okAsync({
          artist: { ...artist, albumCount: albums.length },
          albums: albums.map(mapYmAlbum),
          tracks: (info.popularTracks ?? []).map(track => mapYmTrack(track)),
        });
      }),
    );
  },

  /** Own playlists, liked playlists and the account's likes playlist, in that order. */
  listPlaylists() {
    return withSession(() =>
      ResultAsync.combine([
        ymApi.playlist("{uid}", LIKES_PLAYLIST_KIND).map(playlist => [playlist]),
        ymApi.ownPlaylists(),
        ymApi.likedPlaylists().map(likes => likes.flatMap(likedPlaylistOf)),
      ]).map(uniquePlaylists),
    );
  },

  getPlaylist(id) {
    const ref = ymPlaylistRef(id);
    if (!ref) return notYm("playlist", id);
    return withSession(() =>
      ymApi.playlist(ref.owner, ref.kind).map(playlist => ({
        playlist: mapYmPlaylist({ ...playlist, uid: ymPlaylistOwnerUid(playlist) ?? Number(ref.owner) }),
        tracks: playlistTracks(playlist),
      })),
    );
  },

  search(q, types, p) {
    if (p.offset > 0) return okAsync({ tracks: [], albums: [], artists: [] });
    return withSession(() =>
      ymApi.search(q, "all", 0).map(result => ({
        tracks: types.includes("track") ? (result.tracks?.results ?? []).slice(0, p.limit).map(track => mapYmTrack(track)) : [],
        albums: types.includes("album") ? (result.albums?.results ?? []).slice(0, p.limit).map(mapYmAlbum) : [],
        artists: types.includes("artist") ? artistsOf(result.artists?.results ?? []).slice(0, p.limit) : [],
      })),
    );
  },

  /** Yandex pages by number; the cursor is the next page's number. */
  searchPage(q, scope, cursor) {
    const page = cursor ? Number(cursor) : 0;
    if (!Number.isInteger(page) || page < 0 || page > MAX_SEARCH_PAGE) {
      return errAsync({ kind: "PARSE", message: `Not a Yandex search cursor: ${cursor}` });
    }
    return withSession(() =>
      ymApi.search(q, SEARCH_TYPE[scope], page).map(result => ({
        items: hitsOf(result),
        cursor: hasMore(result, page) ? String(page + 1) : null,
      })),
    );
  },

  getTrack(id) {
    const trackId = ymIdOf(id);
    if (!trackId) return notYm("track", id);
    return withSession(() =>
      ymApi.tracks([trackId]).andThen((tracks) => {
        const track: YmTrack | undefined = tracks.length > 0 ? tracks[0] : undefined;
        if (!track) return errAsync<never, SourceError>({ kind: "NOT_FOUND", message: `Track ${trackId} is unknown to Yandex` });
        return okAsync(mapYmTrack(track));
      }),
    );
  },

  coverUrl(coverRef, size) {
    return ymCoverUrl(coverRef, size);
  },

  /** The media server resolves the real URL per request; nothing to fetch here. */
  resolveStreamUrl(id) {
    const trackId = ymIdOf(id);
    if (!trackId) return notYm("track", id);
    if (!isYmAvailable()) return unavailable<string>();
    return okAsync(ymTrackStreamUrl(trackId));
  },

  prefetch(id) {
    const trackId = ymIdOf(id);
    if (!trackId) return notYm("track", id);
    if (!isYmAvailable()) return unavailable<void>();
    return ResultAsync.fromPromise(invokeCommand(COMMANDS.ymPrefetch, { trackId }), mapYmError);
  },

  /** Rust refuses with FORBIDDEN when Yandex only offers a preview of the track. */
  downloadToFile(id, onProgress) {
    const trackId = ymIdOf(id);
    if (!trackId) return notYm("track", id);
    if (!isYmAvailable()) return unavailable<{ path: string }>();
    const channel = new Channel<DownloadEvent>();
    if (onProgress) channel.onmessage = onProgress;
    // A manager-initiated cancel rejects with kind CANCELLED like any other
    // YmError — the download manager drops the job on it.
    return ResultAsync.fromPromise(
      invokeCommand(COMMANDS.ymDownload, { trackId, onProgress: channel }),
      mapYmError,
    ).map(result => ({ path: result.path, format: { codec: result.ext } }));
  },

  cancelDownload(id) {
    const trackId = ymIdOf(id);
    if (!trackId) return notYm("track", id);
    return ResultAsync.fromPromise(invokeCommand(COMMANDS.ymDownloadCancel, { trackId }), mapYmError);
  },
};
