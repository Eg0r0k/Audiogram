import type {
  YtAlbumDetail,
  YtArtistDetail,
  YtArtistRef,
  YtMusicAlbum,
  YtMusicArtist,
  YtMusicEntity,
  YtMusicPlaylist,
  YtMusicTrack,
  YtPlaylistDetail,
  YtSearchResult,
} from "../types";

//
// youtubei.js nodes → the DTOs the rest of the module has always consumed.
// Inputs are typed structurally (the handful of fields read), so the mappers
// take real parser nodes in the engine and plain objects in tests. Every
// field name here was checked against live responses on 2026-09-17.
//

export interface ThumbLike {
  url: string;
  width: number;
}

export interface RunLike {
  text: string;
  endpoint?: { payload?: { browseId?: string } };
}

/** youtubei.js `Text`: `toString()` yields "N/A" for an empty one. */
export interface TextLike {
  toString: () => string;
  runs?: RunLike[];
}

export interface CreditLike {
  name: string;
  channel_id?: string;
}

/** MusicResponsiveListItem, as the search shelves, album and playlist listings return rows. */
export interface ListItemLike {
  type: string;
  item_type?: string;
  id?: string;
  title?: string;
  name?: string;
  duration?: { seconds: number };
  album?: { id?: string; name: string };
  artists?: CreditLike[];
  authors?: CreditLike[];
  author?: CreditLike;
  index?: TextLike;
  year?: string;
  item_count?: string;
  subscribers?: string;
  thumbnails: ThumbLike[];
  flex_columns?: { title: TextLike }[];
}

/** MusicTwoRowItem, as artist-page carousels return cards. */
export interface TwoRowItemLike {
  type: string;
  item_type: string;
  id?: string;
  title: TextLike;
  subtitle: TextLike;
  artists?: CreditLike[];
  author?: CreditLike;
  year?: string;
  item_count?: string | null;
  subscribers?: string;
  thumbnail: ThumbLike[];
}

export type EntityNodeLike = ListItemLike | TwoRowItemLike;

export interface EndpointLike {
  payload?: {
    browseId?: string;
    videoId?: string;
    browseEndpointContextSupportedConfigs?: { browseEndpointContextMusicConfig?: { pageType?: string } };
  };
}

export interface MusicThumbnailLike {
  contents: ThumbLike[];
}

/** MusicCardShelf: the "top result" card of an unfiltered search. */
export interface CardShelfLike {
  type: "MusicCardShelf";
  title: TextLike;
  subtitle: TextLike;
  thumbnail?: MusicThumbnailLike | null;
  on_tap?: EndpointLike;
  contents?: EntityNodeLike[];
}

export interface ShelfLike {
  type: string;
  title?: TextLike;
  contents?: EntityNodeLike[];
  continuation?: string;
  endpoint?: EndpointLike;
  header?: { title: TextLike } | null;
}

export type SearchSectionLike = CardShelfLike | ShelfLike;

export const bestThumbnail = (thumbs: ThumbLike[] | undefined | null): string | null => {
  let best: ThumbLike | null = null;
  for (const thumb of thumbs ?? []) {
    if (!best || thumb.width > best.width) best = thumb;
  }
  return best?.url ?? null;
};

/** youtubei.js prints "N/A" for an empty Text; neither that nor "" is a value. */
export const textOf = (text: TextLike | undefined | null): string | null => {
  const value = text?.toString() ?? "";
  return value === "" || value === "N/A" ? null : value;
};

const COUNT_SCALES: Record<string, number | undefined> = { K: 1e3, M: 1e6, B: 1e9 };

/** "83.5M", "1,234", "25 songs" → the number, or null when nothing numeric leads. */
export const parseCount = (raw: string | null | undefined): number | null => {
  const match = /^\s*([\d,.]+)\s*([KMB])?/i.exec(raw ?? "");
  if (!match) return null;
  const base = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(base)) return null;
  const suffix: string | undefined = match[2];
  const scale = suffix ? (COUNT_SCALES[suffix.toUpperCase()] ?? 1) : 1;
  return Math.round(base * scale);
};

/**
 * YT Music search rows sometimes leak the type badge ("Song" / "Video", the
 * session is pinned to English) into the credits as an id-less pseudo-artist.
 * A real artist named "Song" would carry a channel id.
 */
const isTypeBadge = (credit: CreditLike): boolean =>
  !credit.channel_id && (credit.name === "Song" || credit.name === "Video");

export const artistRefs = (credits: CreditLike[] | undefined): YtArtistRef[] =>
  (credits ?? [])
    .filter(credit => !isTypeBadge(credit))
    .map(credit => ({ id: credit.channel_id ?? null, name: credit.name }));

/** Credits from subtitle/strapline runs: the runs that link to a `UC…` channel. */
const artistRefsFromRuns = (runs: RunLike[] | undefined): YtArtistRef[] =>
  (runs ?? [])
    .filter(run => run.endpoint?.payload?.browseId?.startsWith("UC"))
    .map(run => ({ id: run.endpoint?.payload?.browseId ?? null, name: run.text }));

const ALBUM_TYPES: Record<string, string> = {
  album: "album",
  single: "single",
  ep: "ep",
  audiobook: "audiobook",
  show: "show",
};

/** "Album" | "Single" | "EP" | … as the DTO spells it; anything else is an album. */
export const albumTypeOf = (label: string | null | undefined): string =>
  ALBUM_TYPES[(label ?? "").trim().toLowerCase()] ?? "album";

const yearOf = (raw: string | null | undefined): number | null => {
  const year = Number(raw);
  return Number.isInteger(year) && year > 1000 ? year : null;
};

/** Playlist browse ids arrive as `VL<playlistId>`; the DTO carries the bare id. */
export const stripPlaylistPrefix = (id: string): string => id.replace(/^VL/, "");

const isTwoRow = (node: EntityNodeLike): node is TwoRowItemLike => node.type === "MusicTwoRowItem";

interface TrackContext {
  /** Album listings type their rows as videos; membership in an album makes them songs. */
  inAlbum?: boolean;
}

export const trackFromListItem = (item: ListItemLike, context: TrackContext = {}): YtMusicTrack | null => {
  if (!item.id || !item.title) return null;
  const trackNr = item.index ? parseCount(textOf(item.index)) : null;
  return {
    id: item.id,
    title: item.title,
    artists: artistRefs(item.artists ?? item.authors),
    album: item.album?.id ? { id: item.album.id, name: item.album.name } : null,
    duration: item.duration?.seconds || null,
    thumbnail: bestThumbnail(item.thumbnails),
    isVideo: item.item_type === "video" && !context.inAlbum,
    trackNr,
  };
};

const trackFromTwoRow = (item: TwoRowItemLike): YtMusicTrack | null => {
  if (!item.id) return null;
  return {
    id: item.id,
    title: textOf(item.title) ?? item.id,
    artists: artistRefs(item.artists ?? (item.author ? [item.author] : [])),
    album: null,
    duration: null,
    thumbnail: bestThumbnail(item.thumbnail),
    isVideo: item.item_type === "video",
    trackNr: null,
  };
};

export const albumFromListItem = (item: ListItemLike): YtMusicAlbum | null => {
  if (!item.id || !item.title) return null;
  return {
    id: item.id,
    title: item.title,
    artists: artistRefs(item.author ? [item.author] : []),
    albumType: albumTypeOf(item.flex_columns?.[1]?.title.runs?.[0]?.text),
    year: yearOf(item.year),
    thumbnail: bestThumbnail(item.thumbnails),
  };
};

const albumFromTwoRow = (item: TwoRowItemLike): YtMusicAlbum | null => {
  if (!item.id) return null;
  return {
    id: item.id,
    title: textOf(item.title) ?? item.id,
    artists: artistRefs(item.artists),
    albumType: albumTypeOf(item.subtitle.runs?.[0]?.text),
    year: yearOf(item.year),
    thumbnail: bestThumbnail(item.thumbnail),
  };
};

export const artistFromListItem = (item: ListItemLike): YtMusicArtist | null => {
  const name = item.name ?? item.title;
  if (!item.id || !name) return null;
  return {
    id: item.id,
    name,
    thumbnail: bestThumbnail(item.thumbnails),
    subscriberCount: parseCount(item.subscribers),
  };
};

const artistFromTwoRow = (item: TwoRowItemLike): YtMusicArtist | null => {
  if (!item.id) return null;
  return {
    id: item.id,
    name: textOf(item.title) ?? item.id,
    thumbnail: bestThumbnail(item.thumbnail),
    subscriberCount: parseCount(item.subscribers),
  };
};

export const playlistFromListItem = (item: ListItemLike): YtMusicPlaylist | null => {
  if (!item.id || !item.title) return null;
  return {
    id: stripPlaylistPrefix(item.id),
    title: item.title,
    owner: item.author?.name ?? null,
    trackCount: parseCount(item.item_count),
    thumbnail: bestThumbnail(item.thumbnails),
  };
};

const playlistFromTwoRow = (item: TwoRowItemLike): YtMusicPlaylist | null => {
  if (!item.id) return null;
  return {
    id: stripPlaylistPrefix(item.id),
    title: textOf(item.title) ?? item.id,
    owner: item.author?.name ?? null,
    trackCount: parseCount(item.item_count),
    thumbnail: bestThumbnail(item.thumbnail),
  };
};

/**
 * Any row or card as a search entity. Rows of kinds the UI has no shape for
 * (podcast shows, profiles) drop out, and so do rows without a watch
 * endpoint — YouTube lists a region-blocked track greyed out, with its title
 * and credits but no video id, and the parser types it "unknown".
 */
export const entityFromNode = (node: EntityNodeLike): YtMusicEntity | null => {
  switch (node.item_type) {
    case "song":
    case "video":
    case "non_music_track": {
      const track = isTwoRow(node) ? trackFromTwoRow(node) : trackFromListItem(node);
      return track ? { kind: "track", ...track } : null;
    }
    case "album": {
      const album = isTwoRow(node) ? albumFromTwoRow(node) : albumFromListItem(node);
      return album ? { kind: "album", ...album } : null;
    }
    case "artist": {
      const artist = isTwoRow(node) ? artistFromTwoRow(node) : artistFromListItem(node);
      return artist ? { kind: "artist", ...artist } : null;
    }
    case "playlist": {
      const playlist = isTwoRow(node) ? playlistFromTwoRow(node) : playlistFromListItem(node);
      return playlist ? { kind: "playlist", ...playlist } : null;
    }
    default:
      return null;
  }
};

export const entitiesFromNodes = (nodes: EntityNodeLike[] | undefined): YtMusicEntity[] =>
  (nodes ?? []).map(entityFromNode).filter((entity): entity is YtMusicEntity => entity !== null);

/** The "top result" card itself, typed by where a tap on it leads. */
export const entityFromCard = (card: CardShelfLike): YtMusicEntity | null => {
  const payload = card.on_tap?.payload;
  const title = textOf(card.title);
  if (!payload || !title) return null;
  const thumbnail = bestThumbnail(card.thumbnail?.contents);
  const pageType = payload.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;

  if (payload.videoId) {
    return {
      kind: "track",
      id: payload.videoId,
      title,
      artists: artistRefsFromRuns(card.subtitle.runs),
      album: null,
      duration: null,
      thumbnail,
      isVideo: card.subtitle.runs?.[0]?.text === "Video",
      trackNr: null,
    };
  }
  if (!payload.browseId) return null;
  if (pageType === "MUSIC_PAGE_TYPE_ARTIST") {
    return { kind: "artist", id: payload.browseId, name: title, thumbnail, subscriberCount: null };
  }
  if (pageType === "MUSIC_PAGE_TYPE_ALBUM") {
    const runs = card.subtitle.runs ?? [];
    return {
      kind: "album",
      id: payload.browseId,
      title,
      artists: artistRefsFromRuns(runs),
      albumType: albumTypeOf(runs[0]?.text),
      year: yearOf(runs[runs.length - 1]?.text),
      thumbnail,
    };
  }
  if (pageType === "MUSIC_PAGE_TYPE_PLAYLIST") {
    return {
      kind: "playlist",
      id: stripPlaylistPrefix(payload.browseId),
      title,
      owner: null,
      trackCount: null,
      thumbnail,
    };
  }
  return null;
};

/** Everything an unfiltered search shows, in page order: the card, its rows, then each shelf's rows. */
export const entitiesFromSearchAll = (sections: SearchSectionLike[] | undefined): YtMusicEntity[] =>
  (sections ?? []).flatMap((section) => {
    if (section.type === "MusicCardShelf") {
      const card = section as CardShelfLike;
      const head = entityFromCard(card);
      return [...(head ? [head] : []), ...entitiesFromNodes(card.contents)];
    }
    return entitiesFromNodes((section as ShelfLike).contents);
  });

/**
 * YT Music's top-result card returns songs stripped down: no artists, no
 * album, no duration, and the artist avatar where the cover belongs. A
 * per-track details lookup carries the real values — whatever the details
 * know wins, the row keeps only the fields they left out.
 */
export const applyTrackDetails = (base: YtMusicTrack, details: YtMusicTrack): YtMusicTrack => ({
  ...base,
  artists: details.artists.length > 0 ? details.artists : base.artists,
  album: details.album ?? base.album,
  duration: details.duration ?? base.duration,
  thumbnail: details.thumbnail ?? base.thumbnail,
});

/**
 * A search row that needs a details lookup before it is usable: the card
 * strips artists entirely, and regular rows can arrive with an artist but
 * no duration or cover — pinning such a row saves a timeless, coverless track.
 */
export const needsDetails = (track: YtMusicTrack): boolean =>
  track.artists.length === 0 || track.duration === null || track.thumbnail === null;

// ── Details (watch page) ────────────────────────────────────────────

export interface BasicInfoLike {
  id?: string;
  title?: string;
  duration?: number;
  author?: string;
  thumbnail?: ThumbLike[];
}

/** PlaylistPanelVideo of the "Up next" queue: the only place a track's credits carry channel ids. */
export interface PanelVideoLike {
  video_id: string;
  album?: { id?: string; name: string };
  artists?: CreditLike[];
}

/** "A, B & C" (YouTube's author string) → names; ids come from the panel row when present. */
const artistsFromAuthor = (author: string | undefined): YtArtistRef[] =>
  (author ?? "")
    .split(/[,&]/)
    .map(name => name.trim())
    .filter(Boolean)
    .map(name => ({ id: null, name }));

export const trackFromInfo = (info: BasicInfoLike, panel: PanelVideoLike | undefined): YtMusicTrack | null => {
  if (!info.id || !info.title) return null;
  const credited = artistRefs(panel?.artists);
  return {
    id: info.id,
    title: info.title,
    artists: credited.length > 0 ? credited : artistsFromAuthor(info.author),
    album: panel?.album?.id ? { id: panel.album.id, name: panel.album.name } : null,
    duration: info.duration || null,
    thumbnail: bestThumbnail(info.thumbnail),
    isVideo: false,
    trackNr: null,
  };
};

// ── Album ───────────────────────────────────────────────────────────

/** MusicResponsiveHeader (current) or MusicDetailHeader (older layout). */
export interface AlbumHeaderLike {
  type: string;
  title: TextLike;
  subtitle: TextLike;
  second_subtitle?: TextLike;
  strapline_text_one?: TextLike;
  thumbnail?: MusicThumbnailLike | null;
  thumbnails?: ThumbLike[];
  year?: string;
  author?: CreditLike;
}

export interface AlbumLike {
  header?: AlbumHeaderLike;
  contents: ListItemLike[];
  url?: string;
}

const headerThumbnail = (header: { thumbnail?: MusicThumbnailLike | ThumbLike[] | null; thumbnails?: ThumbLike[] } | undefined): string | null => {
  if (!header) return null;
  if (Array.isArray(header.thumbnail)) return bestThumbnail(header.thumbnail);
  return bestThumbnail(header.thumbnail?.contents ?? header.thumbnails);
};

const yearFromRuns = (runs: RunLike[] | undefined): number | null =>
  runs?.map(run => yearOf(run.text)).find(year => year !== null) ?? null;

/** `https://music.youtube.com/playlist?list=OLAK5uy_…` → the album's playlist id. */
const playlistIdFromUrl = (url: string | undefined): string | null => {
  if (!url) return null;
  try {
    return new URL(url).searchParams.get("list");
  }
  catch {
    return null;
  }
};

export const albumDetailFrom = (id: string, album: AlbumLike): YtAlbumDetail => {
  const header = album.header;
  const subtitleRuns = header?.subtitle.runs;
  let artists = artistRefsFromRuns(header?.strapline_text_one?.runs);
  if (artists.length === 0) {
    artists = header?.author ? artistRefs([header.author]) : artistRefsFromRuns(subtitleRuns);
  }
  const thumbnail = headerThumbnail(header);
  const tracks = album.contents
    .map(item => trackFromListItem(item, { inAlbum: true }))
    .filter((track): track is YtMusicTrack => track !== null);

  return {
    id,
    playlistId: playlistIdFromUrl(album.url),
    title: textOf(header?.title) ?? id,
    artists,
    albumType: albumTypeOf(subtitleRuns?.[0]?.text),
    year: yearOf(header?.year) ?? yearFromRuns(subtitleRuns),
    thumbnail,
    trackCount: tracks.length,
    tracks,
  };
};

// ── Artist ──────────────────────────────────────────────────────────

export interface ArtistHeaderLike {
  type: string;
  title?: TextLike;
  thumbnail?: MusicThumbnailLike | ThumbLike[] | null;
}

export interface ArtistLike {
  header?: ArtistHeaderLike;
  sections: ShelfLike[];
}

const withoutKind = <T extends { kind: string }>(entity: T): Omit<T, "kind"> => {
  const rest: Omit<T, "kind"> & { kind?: string } = { ...entity };
  delete rest.kind;
  return rest;
};

export interface ArtistDetailParts {
  detail: YtArtistDetail;
  /** The autogenerated "all songs" playlist behind the top-songs shelf — where the durations live. */
  tracksPlaylistId: string | null;
}

export const artistDetailFrom = (id: string, artist: ArtistLike): ArtistDetailParts => {
  const songsShelf = artist.sections.find(section => section.type === "MusicShelf");
  const carousels = artist.sections.filter(section => section.type === "MusicCarouselShelf");
  const cards = carousels.flatMap(section => entitiesFromNodes(section.contents));
  const browseId = songsShelf?.endpoint?.payload?.browseId;

  return {
    detail: {
      id,
      name: textOf(artist.header?.title) ?? id,
      thumbnail: headerThumbnail(artist.header),
      subscriberCount: null,
      topTracks: entitiesFromNodes(songsShelf?.contents)
        .filter((entity): entity is YtMusicEntity & { kind: "track" } => entity.kind === "track")
        .map(withoutKind),
      albums: cards
        .filter((entity): entity is YtMusicEntity & { kind: "album" } => entity.kind === "album")
        .map(withoutKind),
      playlists: cards
        .filter((entity): entity is YtMusicEntity & { kind: "playlist" } => entity.kind === "playlist")
        .map(withoutKind),
    },
    tracksPlaylistId: browseId?.startsWith("VL") ? stripPlaylistPrefix(browseId) : null,
  };
};

/** Artist pages carry no durations; the artist's tracks playlist does — merge by video id. */
export const fillTopTrackDurations = (detail: YtArtistDetail, durations: Map<string, number>): YtArtistDetail => ({
  ...detail,
  topTracks: detail.topTracks.map(track =>
    track.duration === null && durations.has(track.id)
      ? { ...track, duration: durations.get(track.id) ?? null }
      : track,
  ),
});

// ── Playlist ────────────────────────────────────────────────────────

export interface PlaylistHeaderLike {
  type: string;
  title?: TextLike;
  subtitle?: TextLike;
  second_subtitle?: TextLike;
  strapline_text_one?: TextLike;
  description?: TextLike | { description: TextLike } | null;
  thumbnail?: MusicThumbnailLike | null;
  thumbnails?: ThumbLike[];
  author?: CreditLike;
  song_count?: string;
  /** MusicEditablePlaylistDetailHeader wraps the real header. */
  header?: PlaylistHeaderLike;
}

export interface PlaylistLike {
  header?: PlaylistHeaderLike;
  items: { type: string }[];
}

const unwrapHeader = (header: PlaylistHeaderLike | undefined): PlaylistHeaderLike | undefined =>
  header?.type === "MusicEditablePlaylistDetailHeader" ? header.header : header;

const descriptionOf = (header: PlaylistHeaderLike | undefined): string | null => {
  const description = header?.description;
  if (!description) return null;
  return textOf("description" in description ? description.description : description);
};

/** "267K views • 25 tracks • 1 hour" or "25 songs" → 25. */
const trackCountOf = (header: PlaylistHeaderLike | undefined): number | null => {
  const segments = [header?.song_count ?? "", ...(textOf(header?.second_subtitle) ?? "").split("•")];
  const counted = segments
    .map(segment => segment.trim())
    .find(segment => /^[\d,]+ (?:tracks?|songs?)$/i.test(segment));
  return counted ? parseCount(counted) : null;
};

/** Auto-generated YouTube Music lists (radio mixes, album playlists) versus user playlists. */
export const isYtmPlaylist = (id: string): boolean => /^(RDCLAK|OLAK5uy_)/.test(id);

export const playlistDetailFrom = (id: string, playlist: PlaylistLike): Omit<YtPlaylistDetail, "tracks"> & { tracks: YtMusicTrack[] } => {
  const header = unwrapHeader(playlist.header);
  const owner = header?.author?.name ?? textOf(header?.strapline_text_one);
  return {
    id,
    title: textOf(header?.title) ?? id,
    owner,
    description: descriptionOf(header),
    trackCount: trackCountOf(header),
    thumbnail: headerThumbnail(header),
    fromYtm: isYtmPlaylist(id),
    tracks: tracksFromPlaylistItems(playlist.items),
  };
};

export const tracksFromPlaylistItems = (items: { type: string }[]): YtMusicTrack[] =>
  items
    .filter((item): item is ListItemLike => item.type === "MusicResponsiveListItem")
    .map(item => trackFromListItem(item))
    .filter((track): track is YtMusicTrack => track !== null);

// ── Plain video search ──────────────────────────────────────────────

export interface VideoLike {
  type: string;
  id: string;
  title: TextLike;
  author?: { name: string };
  duration?: { seconds: number };
  thumbnails: ThumbLike[];
}

export const videoFromNode = (video: VideoLike): YtSearchResult => ({
  id: video.id,
  title: textOf(video.title) ?? video.id,
  uploader: video.author?.name ?? null,
  duration: video.duration?.seconds || null,
  thumbnail: bestThumbnail(video.thumbnails),
});

export const videosFromNodes = (nodes: { type: string }[] | undefined): YtSearchResult[] =>
  (nodes ?? [])
    .filter((node): node is VideoLike => node.type === "Video")
    .map(videoFromNode);
