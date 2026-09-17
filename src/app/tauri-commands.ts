import { invoke, type Channel } from "@tauri-apps/api/core";
import type { Event, UnlistenFn } from "@tauri-apps/api/event";
import { IS_TAURI } from "@/lib/environment/userAgent";
import type { DownloadEvent } from "@/modules/sources/types";
import type { UpdateInfo, DownloadProgress } from "@/modules/update/types";
import type {
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
} from "@/modules/youtube/types";
import type { DiscordActivityPayload } from "@/modules/player/utils/discordPresence";
import type { ThumbbarAction, ThumbbarState } from "@/modules/player/api/thumbbarApi";
import type {
  YmAuthEvent,
  YmAuthStatus,
  YmDeviceCode,
  YmRequestPayload,
} from "@/modules/sources/yandex/api/types";

//
// The one place the frontend names a Rust command or event (ARCHITECTURE.md
// §5). Adding a command means: a key in COMMANDS, its shape in CommandMap,
// the Rust handler, and the capability entry. Callers are `api/` files and
// services; components and composables go through those.
//

export const COMMANDS = {
  mediaServerBase: "media_server_base",
  imageServerBase: "image_server_base",
  appDataFolderSize: "app_data_folder_size",
  importLocalFile: "import_local_file",
  checkUpdate: "check_update",
  installUpdate: "install_update",
  setProxy: "set_proxy",
  proxyCheck: "proxy_check",
  ndSetConfig: "nd_set_config",
  ndPrefetch: "nd_prefetch",
  ndDownload: "nd_download",
  ndDownloadCancel: "nd_download_cancel",
  ymAuthStatus: "ym_auth_status",
  ymAuthStart: "ym_auth_start",
  ymAuthCancel: "ym_auth_cancel",
  ymAuthLogout: "ym_auth_logout",
  ymRequest: "ym_request",
  ymPrefetch: "ym_prefetch",
  ymDownload: "ym_download",
  ymDownloadCancel: "ym_download_cancel",
  ytSearch: "yt_search",
  ytSearchContinue: "yt_search_continue",
  ytResolve: "yt_resolve",
  ytPrefetch: "yt_prefetch",
  ytDownload: "yt_download",
  ytDownloadCancel: "yt_download_cancel",
  ytMusicDetails: "yt_music_details",
  ytMusicSearch: "yt_music_search",
  ytContinue: "yt_continue",
  ytMusicPlaylist: "yt_music_playlist",
  ytMusicAlbum: "yt_music_album",
  ytMusicArtist: "yt_music_artist",
  discordSetActivity: "discord_set_activity",
  discordClearActivity: "discord_clear_activity",
  thumbbarSetState: "thumbbar_set_state",
} as const;

export type CommandName = (typeof COMMANDS)[keyof typeof COMMANDS];

/** Navidrome auth as the Rust proxy needs it; the raw password never crosses. */
export interface NdConfigPayload {
  baseUrl: string;
  username: string;
  token: string;
  salt: string;
}

export interface CommandMap {
  media_server_base: { args: undefined; result: string };
  image_server_base: { args: undefined; result: string };
  app_data_folder_size: { args: { folder: string }; result: number };
  import_local_file: { args: { source: string; targetRel: string }; result: number };
  check_update: { args: undefined; result: UpdateInfo | null };
  install_update: { args: undefined; result: void };
  set_proxy: { args: { url: string | null }; result: void };
  proxy_check: { args: { url: string }; result: number };
  nd_set_config: { args: { config: NdConfigPayload | null }; result: void };
  nd_prefetch: { args: { songId: string }; result: void };
  nd_download: {
    args: { songId: string; suffix: string | null; onProgress: Channel<DownloadEvent> };
    result: { path: string; ext: string };
  };
  nd_download_cancel: { args: { songId: string }; result: void };
  ym_auth_status: { args: undefined; result: YmAuthStatus };
  ym_auth_start: { args: undefined; result: YmDeviceCode };
  ym_auth_cancel: { args: undefined; result: void };
  ym_auth_logout: { args: undefined; result: void };
  /** The `result` of the API envelope; the caller narrows it. */
  ym_request: { args: { req: YmRequestPayload }; result: unknown };
  ym_prefetch: { args: { trackId: string }; result: void };
  ym_download: {
    args: { trackId: string; onProgress: Channel<DownloadEvent> };
    result: { path: string; ext: string };
  };
  ym_download_cancel: { args: { trackId: string }; result: void };
  yt_search: { args: { query: string }; result: YtPage<YtSearchResult> };
  yt_search_continue: { args: { continuation: string }; result: YtPage<YtSearchResult> };
  yt_resolve: { args: { id: string }; result: string };
  yt_prefetch: { args: { id: string }; result: void };
  yt_download: {
    args: { id: string; meta: YtTrackMeta | null; onProgress: Channel<YtDownloadEvent> };
    result: YtDownloadResult;
  };
  yt_download_cancel: { args: { id: string }; result: void };
  yt_music_details: { args: { id: string }; result: YtMusicTrack };
  yt_music_search: { args: { query: string; kind: YtMusicSearchKind }; result: YtPage<YtMusicEntity> };
  yt_continue: { args: { continuation: string; kind: YtMusicSearchKind }; result: YtPage<YtMusicEntity> };
  yt_music_playlist: { args: { id: string }; result: YtPlaylistDetail };
  yt_music_album: { args: { id: string }; result: YtAlbumDetail };
  yt_music_artist: { args: { id: string }; result: YtArtistDetail };
  discord_set_activity: { args: { payload: DiscordActivityPayload }; result: void };
  discord_clear_activity: { args: undefined; result: void };
  thumbbar_set_state: { args: { state: ThumbbarState }; result: void };
}

type ArgsOf<N extends CommandName> = CommandMap[N]["args"];
type ArgsTuple<N extends CommandName> = ArgsOf<N> extends undefined ? [] : [args: ArgsOf<N>];

export class PlatformUnavailableError extends Error {
  constructor(public readonly command: CommandName, public readonly reason: unknown) {
    super(`"${command}" needs the desktop or mobile app; this build runs in the browser`);
    this.name = "PlatformUnavailableError";
  }
}

export const invokeCommand = async <N extends CommandName>(
  name: N,
  ...args: ArgsTuple<N>
): Promise<CommandMap[N]["result"]> => {
  try {
    return await (args.length === 0
      ? invoke<CommandMap[N]["result"]>(name)
      : invoke<CommandMap[N]["result"]>(name, args[0]));
  }
  catch (error) {
    // Without the bridge tauri's invoke itself throws a TypeError on
    // window.__TAURI_INTERNALS__; name the platform instead of leaking that.
    // Anything else (a mocked or real command rejection) passes through.
    if (!IS_TAURI && error instanceof TypeError) throw new PlatformUnavailableError(name, error);
    throw error;
  }
};

export const EVENTS = {
  filesOpened: "files-opened",
  thumbbarAction: "thumbbar-action",
  windowResize: "tauri://resize",
  updateDownloadProgress: "update://download-progress",
  updateInstallStarted: "update://install-started",
  ymAuth: "ym:auth",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export interface EventMap {
  "files-opened": string[];
  "thumbbar-action": ThumbbarAction;
  "tauri://resize": unknown;
  "update://download-progress": DownloadProgress;
  "update://install-started": unknown;
  "ym:auth": YmAuthEvent;
}

/**
 * Subscribes to a Rust-emitted event. Resolves to the unlisten function; the
 * event module is loaded lazily so the web bundle never touches it.
 */
export const listenEvent = async <N extends EventName>(
  name: N,
  handler: (event: Event<EventMap[N]>) => void,
): Promise<UnlistenFn> => {
  const { listen } = await import("@tauri-apps/api/event");
  return listen<EventMap[N]>(name, handler);
};
