import { ResultAsync, errAsync } from "neverthrow";
import { platformCaps } from "@/lib/environment/platformCaps";
import type {
  YoutubeError,
  YoutubeErrorKind,
  YtAlbumDetail,
  YtArtistDetail,
  YtDownloadEvent,
  YtDownloadResult,
  YtMusicEntity,
  YtMusicSearchKind,
  YtMusicTrack,
  YtPage,
  YtPlaylistDetail,
  YtSearchResult,
  YtTrackMeta,
} from "./types";
import {
  cancelYoutubeDownload,
  downloadYoutube,
  prefetchYoutube,
  resolveYoutube,
} from "./api/youtubeApi";
import { ytEngine, type YtEngine } from "./engine/engine";
import { toYoutubeError } from "./engine/errors";

/**
 * Platform-agnostic YouTube access. In the app the catalog (search, browse,
 * details) is served by the Innertube engine running in the webview, fully
 * anonymous — no cookies or login; streams and downloads go through the
 * Rust transport. The web build stays behind {@link noopProvider}.
 */
export interface YoutubeProvider {
  readonly isAvailable: boolean;
  search(query: string): ResultAsync<YtSearchResult[], YoutubeError>;
  searchVideos(query: string): ResultAsync<YtPage<YtSearchResult>, YoutubeError>;
  continueVideos(continuation: string): ResultAsync<YtPage<YtSearchResult>, YoutubeError>;
  searchMusic(
    query: string,
    kind: YtMusicSearchKind,
  ): ResultAsync<YtPage<YtMusicEntity>, YoutubeError>;
  continueMusic(
    continuation: string,
    kind: YtMusicSearchKind,
  ): ResultAsync<YtPage<YtMusicEntity>, YoutubeError>;
  playlist(id: string): ResultAsync<YtPlaylistDetail, YoutubeError>;
  album(id: string): ResultAsync<YtAlbumDetail, YoutubeError>;
  artist(id: string): ResultAsync<YtArtistDetail, YoutubeError>;
  /** Full metadata for one track — the pin-time safety net for rows that slipped past search enrichment. */
  track(id: string): ResultAsync<YtMusicTrack, YoutubeError>;
  resolve(id: string): ResultAsync<string, YoutubeError>;
  /** Warms the backend audio cache so the track starts instantly when played. */
  prefetch(id: string): ResultAsync<void, YoutubeError>;
  download(
    id: string,
    onEvent?: (event: YtDownloadEvent) => void,
    meta?: YtTrackMeta,
  ): ResultAsync<YtDownloadResult, YoutubeError>;
  cancelDownload(id: string): ResultAsync<void, YoutubeError>;
}

const unavailable = <T>(): ResultAsync<T, YoutubeError> =>
  errAsync<T, YoutubeError>({
    kind: "UNAVAILABLE",
    message: "YouTube is only available in the app",
  });

const fromEngine = <T>(run: () => Promise<T>, fallback: YoutubeErrorKind): ResultAsync<T, YoutubeError> =>
  ResultAsync.fromPromise(run(), error => toYoutubeError(error, fallback));

export const createInnertubeProvider = (engine: YtEngine): YoutubeProvider => ({
  isAvailable: true,
  search: query => fromEngine(() => engine.searchVideos(query), "SEARCH_FAILED").map(page => page.items),
  searchVideos: query => fromEngine(() => engine.searchVideos(query), "SEARCH_FAILED"),
  continueVideos: continuation => fromEngine(() => engine.continueVideos(continuation), "SEARCH_FAILED"),
  searchMusic: (query, kind) => fromEngine(() => engine.searchMusic(query, kind), "SEARCH_FAILED"),
  // The token knows which listing it continues; `kind` only exists for the contract.
  continueMusic: continuation => fromEngine(() => engine.continueMusic(continuation), "SEARCH_FAILED"),
  playlist: id => fromEngine(() => engine.playlist(id), "SEARCH_FAILED"),
  album: id => fromEngine(() => engine.album(id), "SEARCH_FAILED"),
  artist: id => fromEngine(() => engine.artist(id), "SEARCH_FAILED"),
  track: id => fromEngine(() => engine.track(id), "SEARCH_FAILED"),
  resolve: id => resolveYoutube(id),
  prefetch: id => prefetchYoutube(id),
  // Retries belong to the download manager (single layer, with backoff) —
  // one provider call is exactly one yt_download run.
  download: (id, onEvent, meta) => downloadYoutube(id, onEvent, meta),
  cancelDownload: id => cancelYoutubeDownload(id),
});

const noopProvider: YoutubeProvider = {
  isAvailable: false,
  search: () => unavailable<YtSearchResult[]>(),
  searchVideos: () => unavailable<YtPage<YtSearchResult>>(),
  continueVideos: () => unavailable<YtPage<YtSearchResult>>(),
  searchMusic: () => unavailable<YtPage<YtMusicEntity>>(),
  continueMusic: () => unavailable<YtPage<YtMusicEntity>>(),
  playlist: () => unavailable<YtPlaylistDetail>(),
  album: () => unavailable<YtAlbumDetail>(),
  artist: () => unavailable<YtArtistDetail>(),
  track: () => unavailable<YtMusicTrack>(),
  resolve: () => unavailable<string>(),
  prefetch: () => unavailable<void>(),
  download: () => unavailable<YtDownloadResult>(),
  cancelDownload: () => unavailable<void>(),
};

export const youtubeProvider: YoutubeProvider
  = platformCaps.hasYoutube ? createInnertubeProvider(ytEngine) : noopProvider;
