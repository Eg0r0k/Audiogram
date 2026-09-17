import { YTNodes, type APIResponseTypes, type Innertube, type Types, type YTMusic } from "youtubei.js";
import { getLogger } from "@/lib/logger";
import { currentProxyUrl } from "@/modules/settings/services/proxy";
import type {
  YtAlbumDetail,
  YtArtistDetail,
  YtMusicEntity,
  YtMusicSearchKind,
  YtMusicTrack,
  YtPage,
  YtPlaylistDetail,
  YtSearchResult,
} from "../types";
import { createContinuationRegistry, type ContinuationRegistry } from "./continuations";
import { YtContinuationExpiredError } from "./errors";
import {
  albumDetailFrom,
  applyTrackDetails,
  artistDetailFrom,
  entitiesFromNodes,
  entitiesFromSearchAll,
  fillTopTrackDurations,
  needsDetails,
  playlistDetailFrom,
  textOf,
  trackFromInfo,
  tracksFromPlaylistItems,
  videosFromNodes,
  type ArtistLike,
  type EntityNodeLike,
  type PanelVideoLike,
  type SearchSectionLike,
} from "./mappers";
import { createYtSession, type YtSession } from "./session";
import { createYtFetch } from "./transport";

//
// The catalog half of the YouTube engine: search, browse and details over
// youtubei.js, shaped into the module's DTOs. Everything above provider.ts
// is unaware that Rust ever did this.
//

export interface YtEngine {
  searchMusic: (query: string, kind: YtMusicSearchKind) => Promise<YtPage<YtMusicEntity>>;
  continueMusic: (token: string) => Promise<YtPage<YtMusicEntity>>;
  searchVideos: (query: string) => Promise<YtPage<YtSearchResult>>;
  continueVideos: (token: string) => Promise<YtPage<YtSearchResult>>;
  album: (id: string) => Promise<YtAlbumDetail>;
  artist: (id: string) => Promise<YtArtistDetail>;
  playlist: (id: string) => Promise<YtPlaylistDetail>;
  track: (id: string) => Promise<YtMusicTrack>;
  /** The live Innertube session, for the stream half of the engine. */
  session: YtSession;
}

interface EngineDeps {
  session: YtSession;
  musicPages?: ContinuationRegistry<YtPage<YtMusicEntity>>;
  videoPages?: ContinuationRegistry<YtPage<YtSearchResult>>;
}

const MUSIC_SEARCH_TYPE: Record<Exclude<YtMusicSearchKind, "all">, Types.MusicSearchType> = {
  tracks: "song",
  albums: "album",
  artists: "artist",
  playlists: "playlist",
};

/** Stripped rows are rare per page; a handful of parallel lookups covers them without a request fan-out. */
const MAX_ENRICHED_TRACKS = 6;

type MusicSearchContinuation = Awaited<ReturnType<YTMusic.Search["getContinuation"]>>;

const emptyPage = <T>(): YtPage<T> => ({ items: [], continuation: null, total: null, correctedQuery: null });

export const createYtEngine = (deps: EngineDeps): YtEngine => {
  const { session } = deps;
  const musicPages = deps.musicPages ?? createContinuationRegistry<YtPage<YtMusicEntity>>();
  const videoPages = deps.videoPages ?? createContinuationRegistry<YtPage<YtSearchResult>>();

  const track = async (id: string): Promise<YtMusicTrack> => {
    const yt = await session.get();
    const info = await yt.music.getInfo(id);
    let panel: PanelVideoLike | undefined;
    try {
      const upNext = await info.getUpNext(false);
      panel = upNext.contents
        .filterType(YTNodes.PlaylistPanelVideo)
        .find(video => video.video_id === id);
    }
    catch {
      // The queue is a bonus (credits with channel ids); basic_info still names the track.
    }
    const mapped = trackFromInfo(info.basic_info, panel);
    if (!mapped) throw new Error("watch page carried no track info");
    return mapped;
  };

  /** Fills artist/album/duration/cover for rows YouTube returned without them; never fails the page. */
  const enrich = async (items: YtMusicEntity[]): Promise<YtMusicEntity[]> => {
    const enriched = [...items];
    const targets = enriched
      .map((entity, index) => ({ entity, index }))
      .filter((slot): slot is { entity: YtMusicEntity & { kind: "track" }; index: number } =>
        slot.entity.kind === "track" && needsDetails(slot.entity))
      .slice(0, MAX_ENRICHED_TRACKS);

    await Promise.all(targets.map(async ({ entity, index }) => {
      try {
        const details = await track(entity.id);
        enriched[index] = { kind: "track", ...applyTrackDetails(entity, details) };
      }
      catch (error) {
        getLogger().warn(`[YT] Details for ${entity.id} failed, keeping the stripped row: ${String(error)}`);
      }
    }));
    return enriched;
  };

  const musicPage = async (
    items: YtMusicEntity[],
    next: (() => Promise<YtPage<YtMusicEntity>>) | null,
    correctedQuery: string | null = null,
  ): Promise<YtPage<YtMusicEntity>> => ({
    items: await enrich(items),
    continuation: next ? musicPages.register(next) : null,
    total: null,
    correctedQuery,
  });

  const searchContinuationPage = (page: MusicSearchContinuation): Promise<YtPage<YtMusicEntity>> =>
    musicPage(
      entitiesFromNodes(page.contents?.contents as unknown as EntityNodeLike[] | undefined),
      page.has_continuation ? async () => searchContinuationPage(await page.getContinuation()) : null,
    );

  const searchMusic = async (query: string, kind: YtMusicSearchKind): Promise<YtPage<YtMusicEntity>> => {
    const trimmed = query.trim();
    if (!trimmed) return emptyPage();
    const yt = await session.get();

    if (kind === "all") {
      const result = await yt.music.search(trimmed);
      const corrected = textOf(result.showing_results_for?.corrected_query)
        ?? textOf(result.did_you_mean?.corrected_query);
      return musicPage(entitiesFromSearchAll(result.contents as unknown as SearchSectionLike[] | undefined), null, corrected);
    }

    const result = await yt.music.search(trimmed, { type: MUSIC_SEARCH_TYPE[kind] });
    const shelf = result.contents?.firstOfType(YTNodes.MusicShelf);
    return musicPage(
      entitiesFromNodes(shelf?.contents),
      result.has_continuation ? async () => searchContinuationPage(await result.getContinuation()) : null,
      textOf(result.showing_results_for?.corrected_query) ?? textOf(result.did_you_mean?.corrected_query),
    );
  };

  const continueMusic = async (token: string): Promise<YtPage<YtMusicEntity>> => {
    const next = musicPages.resolve(token);
    if (!next) throw new YtContinuationExpiredError();
    return next();
  };

  const videoPageFromData = (
    yt: Innertube,
    data: APIResponseTypes.ISearchResponse | undefined,
  ): YtPage<YtSearchResult> => {
    const memo = data?.on_response_received_commands_memo;
    const items = videosFromNodes(memo?.getType(YTNodes.Video));
    const continuationItem = memo?.getType(YTNodes.ContinuationItem)[0];
    return {
      items,
      continuation: continuationItem
        ? videoPages.register(async () =>
            videoPageFromData(yt, await continuationItem.endpoint.call<APIResponseTypes.ISearchResponse>(yt.actions, { parse: true })))
        : null,
      total: null,
      correctedQuery: null,
    };
  };

  const searchVideos = async (query: string): Promise<YtPage<YtSearchResult>> => {
    const trimmed = query.trim();
    if (!trimmed) return emptyPage();
    const yt = await session.get();
    const result = await yt.search(trimmed, { type: "video" });
    return {
      items: videosFromNodes(result.results),
      // Search#getContinuation trips over a header-less continuation page
      // (youtubei.js 18.0.0), so the raw data is walked here instead.
      continuation: result.has_continuation
        ? videoPages.register(async () => videoPageFromData(yt, await result.getContinuationData()))
        : null,
      total: result.estimated_results || null,
      correctedQuery: null,
    };
  };

  const continueVideos = async (token: string): Promise<YtPage<YtSearchResult>> => {
    const next = videoPages.resolve(token);
    if (!next) throw new YtContinuationExpiredError();
    return next();
  };

  const album = async (id: string): Promise<YtAlbumDetail> => {
    const yt = await session.get();
    const page = await yt.music.getAlbum(id);
    return albumDetailFrom(id, page);
  };

  const artist = async (id: string): Promise<YtArtistDetail> => {
    const yt = await session.get();
    const page = await yt.music.getArtist(id);
    const { detail, tracksPlaylistId } = artistDetailFrom(id, page as unknown as ArtistLike);
    if (!tracksPlaylistId || detail.topTracks.every(top => top.duration !== null)) return detail;
    try {
      const playlist = await yt.music.getPlaylist(tracksPlaylistId);
      const durations = new Map<string, number>();
      for (const item of tracksFromPlaylistItems(playlist.items)) {
        if (item.duration !== null) durations.set(item.id, item.duration);
      }
      return fillTopTrackDurations(detail, durations);
    }
    catch (error) {
      getLogger().debug(`[YT] Top-track durations for ${id} unavailable: ${String(error)}`);
      return detail;
    }
  };

  const playlistTracksPage = (page: YTMusic.Playlist): Promise<YtPage<YtMusicEntity>> =>
    musicPage(
      tracksFromPlaylistItems(page.items).map(item => ({ kind: "track" as const, ...item })),
      page.has_continuation ? async () => playlistTracksPage(await page.getContinuation()) : null,
    );

  const playlist = async (id: string): Promise<YtPlaylistDetail> => {
    const yt = await session.get();
    const page = await yt.music.getPlaylist(id);
    // A deleted or private list parses as a page with neither header nor rows.
    if (!page.header && page.items.length === 0) throw new Error("Playlist not found");
    const detail = playlistDetailFrom(id, page);
    return {
      ...detail,
      tracks: {
        items: detail.tracks,
        continuation: page.has_continuation
          ? musicPages.register(async () => playlistTracksPage(await page.getContinuation()))
          : null,
        total: detail.trackCount,
        correctedQuery: null,
      },
    };
  };

  return { searchMusic, continueMusic, searchVideos, continueVideos, album, artist, playlist, track, session };
};

const defaultSession = createYtSession({
  fetch: createYtFetch(currentProxyUrl),
  proxyUrl: currentProxyUrl,
});

export const ytEngine: YtEngine = createYtEngine({ session: defaultSession });
