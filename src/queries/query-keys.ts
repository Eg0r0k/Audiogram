import type { AlbumId, ArtistId, PlaylistId, TagId, TrackId } from "@/types/ids";
import type { TrackSortKey } from "@/types/track-sort";
import type { SourceKind } from "@/types/track-ref";

// A collection's paged tracks. The sort is part of the key only when chosen;
// a search inside the collection adds a tail the page patches recognise
// (`keyMatchers.searchScopedPages`) so rows are not appended to a filtered view.
const tracksPageKey = (
  root: "artists" | "albums" | "playlists",
  id: string,
  sortKey?: TrackSortKey | null,
  search?: string,
): readonly unknown[] => {
  const base = sortKey ? [root, id, "tracks", "page", sortKey] : [root, id, "tracks", "page"];
  return search ? [...base, "search", search] : base;
};

// `detail(id)` is the root of everything cached under one entity (its row
// lookup, paged tracks, duration): invalidating or removing it by prefix
// covers the whole subtree. Keep every per-entity key under that prefix.
export const queryKeys = {
  library: {
    summary: () => ["library", "summary"] as const,
  },
  artists: {
    all: () => ["artists"] as const,
    detail: (id: ArtistId) => ["artists", id] as const,
    /** Row-or-null lookup; unlike `detail` it does not throw on a miss. */
    libraryRow: (id: ArtistId | null) => ["artists", id, "libraryRow"] as const,
    search: (query: string) => ["artists", "search", query] as const,
    albums: (id: ArtistId) => ["artists", id, "albums"] as const,
    tracksPage: (id: ArtistId, sortKey?: TrackSortKey | null, search?: string) =>
      tracksPageKey("artists", id, sortKey, search),
  },
  albums: {
    all: () => ["albums"] as const,
    detail: (id: AlbumId) => ["albums", id] as const,
    /** Row-or-null lookup; unlike `detail` it does not throw on a miss. */
    libraryRow: (id: AlbumId | null) => ["albums", id, "libraryRow"] as const,
    search: (query: string) => ["albums", "search", query] as const,
    tracksPage: (id: AlbumId, sortKey?: TrackSortKey | null, search?: string) =>
      tracksPageKey("albums", id, sortKey, search),
    totalDuration: (id: AlbumId) => ["albums", id, "totalDuration"] as const,
  },
  playlists: {
    all: () => ["playlists"] as const,
    detail: (id: PlaylistId) => ["playlists", id] as const,
    /** Row-or-null lookup; unlike `detail` it does not throw on a miss. */
    libraryRow: (id: PlaylistId | null) => ["playlists", id, "libraryRow"] as const,
    tracksPage: (id: PlaylistId, sortKey?: TrackSortKey | null, search?: string) =>
      tracksPageKey("playlists", id, sortKey, search),
    totalDuration: (id: PlaylistId) => ["playlists", id, "totalDuration"] as const,
  },
  tracks: {
    all: () => ["tracks"] as const,
    detail: (id: TrackId) => ["tracks", id] as const,
    likedPageInfinite: (sortKey?: TrackSortKey | null, search?: string): readonly unknown[] => {
      const base = sortKey
        ? ["tracks", "liked", "page", "infinite", sortKey]
        : ["tracks", "liked", "page", "infinite"];
      return search ? [...base, "search", search] : base;
    },
    likedTotalDuration: () => ["tracks", "liked", "totalDuration"] as const,
    byIds: (ids: readonly TrackId[]) => ["tracks", "byIds", ...ids] as const,
    allPaginated: (search = "") => ["tracks", "all", "paginated", search] as const,
    indexInfinite: (sortKey: TrackSortKey | null, search = "") => ["tracks", "index", "infinite", sortKey, search] as const,
    indexTotalDuration: (search = "") => ["tracks", "index", "totalDuration", search] as const,
  },
  trackChapters: {
    detail: (trackId: TrackId) => ["trackChapters", trackId] as const,
  },
  offlineCopies: {
    all: () => ["offlineCopies"] as const,
    detail: (trackId: TrackId) => ["offlineCopies", trackId] as const,
  },
  tags: {
    all: () => ["tags"] as const,
    detail: (id: TagId) => ["tags", id] as const,
    byTrack: (trackId: TrackId) => ["tags", "track", trackId] as const,
  },
  recommendations: {
    all: () => ["recommendations"] as const,
    forTrack: (trackId: TrackId, limit: number) =>
      ["recommendations", "forTrack", trackId, limit] as const,
  },
  source: {
    /** Every remote catalog answer, whatever source it came from. */
    all: () => ["source"] as const,
    /** One source's slice of the above. */
    ofKind: (kind: SourceKind) => ["source", kind] as const,
    artists: (kind: SourceKind | null) => ["source", kind, "artists"] as const,
    /** Every album page of a source, whatever the sort — the prefix of albumsInf. */
    albums: (kind: SourceKind | null) => ["source", kind, "albums"] as const,
    albumsInf: (kind: SourceKind | null, sort: string) => ["source", kind, "albums", sort] as const,
    // Null ids come from skipToken-parked options.
    album: (kind: SourceKind | null, id: AlbumId | null) => ["source", kind, "album", id] as const,
    artist: (kind: SourceKind | null, id: ArtistId | null) => ["source", kind, "artist", id] as const,
    playlists: (kind: SourceKind | null) => ["source", kind, "playlists"] as const,
    playlist: (kind: SourceKind | null, id: string | null) => ["source", kind, "playlist", id] as const,
    playlistMeta: (kind: SourceKind | null, id: string | null) => ["source", kind, "playlist", id, "meta"] as const,
    playlistPages: (kind: SourceKind | null, id: string | null) => ["source", kind, "playlist", id, "pages"] as const,
    search: (kind: SourceKind | null, q: string) => ["source", kind, "search", q] as const,
    searchPages: (kind: SourceKind | null, scope: string, q: string) =>
      ["source", kind, "search", q, "pages", scope] as const,
  },
  youtube: {
    all: () => ["youtube"] as const,
    /**
     * Plain-video search — the one YouTube query with no generic counterpart.
     * Music search caches under queryKeys.source like every other source's,
     * and so do albums, artists and playlists, whatever source they came from.
     */
    videoSearch: (query: string) => ["youtube", "search", "videos", query] as const,
  },
  stats: {
    all: () => ["stats"] as const,
    /** Raw listen events of a period — the shared read behind the aggregates below. */
    events: (since?: number) => ["stats", "events", since] as const,
    topTracks: (limit: number, since?: number) =>
      ["stats", "topTracks", limit, since] as const,
    topTracksMeta: (ids: readonly string[]) =>
      ["stats", "topTracksMeta", ...ids] as const,
    topArtists: (limit: number, since?: number) =>
      ["stats", "topArtists", limit, since] as const,
    artistPlays: (artistId: string) =>
      ["stats", "artistPlays", artistId] as const,
    topGenres: (limit: number, since?: number) => ["stats", "topGenres", limit, since] as const,
    totalTime: (since?: number) => ["stats", "totalTime", since] as const,
    dailyActivity: (days: number) => ["stats", "dailyActivity", days] as const,
    recentHistory: (limit: number) => ["stats", "recentHistory", limit] as const,
    summary: (since?: number) => ["stats", "summary", since] as const,
    hourlyActivity: (since?: number) => ["stats", "hourlyActivity", since] as const,
    records: (since?: number) => ["stats", "records", since] as const,
    streaks: () => ["stats", "streaks"] as const,
  },
} as const;

type QueryKey = readonly unknown[];

type EntityRoot = "albums" | "artists" | "playlists";

const ENTITY_ROOTS: ReadonlySet<unknown> = new Set<EntityRoot>(["albums", "artists", "playlists"]);

const isEntityTracksPage = (key: QueryKey) =>
  ENTITY_ROOTS.has(key[0]) && key[2] === "tracks" && key[3] === "page";

const isLikedPage = (key: QueryKey) =>
  key[0] === "tracks" && key[1] === "liked" && key[2] === "page" && key[3] === "infinite";

const isIndexPage = (key: QueryKey) =>
  key[0] === "tracks" && key[1] === "index" && key[2] === "infinite";

const isSearchScopedPage = (key: QueryKey) =>
  (isEntityTracksPage(key) || isLikedPage(key)) && (key[4] === "search" || key[5] === "search");

/**
 * Shape tests over cached keys, for patches and invalidations that have to
 * reach every id at once. They mirror the factories above: a new key shape
 * that carries track rows must be added to `trackPages`.
 */
export const keyMatchers = {
  /** The paged track lists of every entity under `root`, any sort. */
  tracksPagesOf: (root: EntityRoot) => (key: QueryKey) => key[0] === root && isEntityTracksPage(key),
  /** The paged track lists of one entity, any sort. */
  tracksPagesOfEntity: (root: EntityRoot, id: string) => (key: QueryKey) =>
    key[0] === root && key[1] === id && isEntityTracksPage(key),
  /** One entity's lists under a sort key, unfiltered; rows added to the entity are counted there, not placed. */
  sortedTracksPagesOfEntity: (root: EntityRoot, id: string) => (key: QueryKey) =>
    key[0] === root && key[1] === id && isEntityTracksPage(key) && key.length > 4 && !isSearchScopedPage(key),
  /** The liked list, any sort. */
  likedPages: isLikedPage,
  /** The liked list in its default order (likedAt desc) — the one a like is patched into. */
  likedDefaultPage: (key: QueryKey) => isLikedPage(key) && key.length === 4,
  /** The liked list under a sort key; a like is re-read there, not patched. */
  likedSortedPages: (key: QueryKey) => isLikedPage(key) && key.length > 4,
  /** Every offset-paged list of track rows: the index, the liked list and the per-entity lists. */
  trackPages: (key: QueryKey) => isIndexPage(key) || isLikedPage(key) || isEntityTracksPage(key),
  /** The flat `Track[]` lookups by id (search pane rows, download titles). */
  trackRows: (key: QueryKey) => key[0] === "tracks" && key[1] === "byIds",
  /** A collection page filtered by a search: rows are never appended to it, it is re-read. */
  searchScopedPages: isSearchScopedPage,
} as const;
