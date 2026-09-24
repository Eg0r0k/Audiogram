import type {
  AlbumEntity,
  ArtistEntity,
  CoverOwnerType,
  PlaylistEntity,
  TrackEntity,
} from "@/db/entities";
import { keyMatchers, queryKeys } from "@/queries/query-keys";
import type { Track } from "@/modules/player/types";
import type { AlbumId, ArtistId, PlaylistId } from "@/types/ids";
import type { InfiniteData, InvalidateQueryFilters, Query, QueryClient } from "@tanstack/vue-query";
import { removeById, upsertById } from "./shared";
import type {
  LibrarySummaryData,
  PaginatedAlbumsResult,
  PaginatedTracksResult,
} from "./types";
import { coverCache } from "@/modules/covers/lib/cover-cache";
import type { CoverRow } from "./cover.queries";
import { markRecommenderContextDirty } from "@/modules/recommendations/service/recommender-context.service";

//
// Point-syncs write the outcome of a mutation into the caches a mounted view
// reads, so the change shows before any re-read lands. An entity's own row
// (`detail`) is written unconditionally and seeds the next mount; every
// other key — the summary, `playlists.all`, the stats rows, the offset-paged
// lists matched by `keyMatchers` — is patched only while it already holds
// data. Whatever a patch cannot place is re-read through the invalidation
// registry at the bottom.
//

type TrackPages = InfiniteData<PaginatedTracksResult>;

type QueryKeyMatch = (key: readonly unknown[]) => boolean;

// `setQueryData` builds an entry for a key it has never seen; answering
// `undefined` for one keeps a patch to the keys that already hold data.
const setQueryDataIfPresent = <T>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  updater: (data: T) => T,
) => {
  queryClient.setQueryData<T | undefined>(queryKey, old =>
    old === undefined ? old : updater(old),
  );
};

const setQueriesDataIfPresent = <T>(
  queryClient: QueryClient,
  match: QueryKeyMatch,
  updater: (data: T) => T,
) => {
  queryClient.setQueriesData<T | undefined>(
    { predicate: query => match(query.queryKey) },
    old => (old === undefined ? old : updater(old)),
  );
};

/** Moves the two liked aggregates (the summary's count, the cached duration sum) by a delta each. */
const patchLikedAggregates = (queryClient: QueryClient, countDelta: number, durationDelta: number) => {
  if (countDelta !== 0) {
    setQueryDataIfPresent<LibrarySummaryData>(queryClient, queryKeys.library.summary(), data => ({
      ...data,
      likedCount: Math.max(0, data.likedCount + countDelta),
    }));
  }
  if (durationDelta !== 0) {
    setQueryDataIfPresent<number>(queryClient, queryKeys.tracks.likedTotalDuration(), current =>
      Math.max(0, current + durationDelta),
    );
  }
};

// A matcher may be widened by mistake onto a key holding another shape (a
// scalar aggregate, an entity row); a page patch must then leave it alone.
const isPagedData = (data: unknown): boolean =>
  Array.isArray((data as { pages?: unknown } | null | undefined)?.pages);

/**
 * Pages are offset-paged over Dexie: a row added or dropped in place shifts
 * everything after it, so the next fetch must start where the cached rows
 * now end, not where the page said they ended when it was read.
 */
const recountOffsets = <P extends { nextOffset: number | null }>(
  pages: P[],
  rowsOf: (page: P) => readonly unknown[],
): P[] => {
  let offset = 0;
  return pages.map((page) => {
    offset += rowsOf(page).length;
    return page.nextOffset === null ? page : { ...page, nextOffset: offset };
  });
};

const trackRowsOf = (page: PaginatedTracksResult) => page.tracks;
const albumRowsOf = (page: PaginatedAlbumsResult) => page.albums;

/**
 * Rebuilds only the pages `mapTracks` actually changed — it signals "no
 * change" by handing its input back. A list scrolled deep into a large
 * library holds thousands of rows across hundreds of pages, and patching one
 * row must not allocate a new array for each of them (nor leave structural
 * sharing to walk every row afterwards undoing the churn).
 */
const mapInfiniteTrackPages = (
  data: TrackPages,
  mapTracks: (tracks: Track[]) => Track[],
): TrackPages => {
  if (!isPagedData(data)) return data;
  // A plain loop, not map(): type-aware lint (no-unnecessary-condition) does
  // not follow an assignment made inside a callback, so it narrows `changed`
  // to `false` and rejects the check below as dead.
  const pages: PaginatedTracksResult[] = [];
  let changed = false;
  for (const page of data.pages) {
    const tracks = mapTracks(page.tracks);
    if (tracks === page.tracks) {
      pages.push(page);
      continue;
    }
    changed = true;
    pages.push({ ...page, tracks });
  }
  return changed ? { ...data, pages } : data;
};

// Scanning first keeps the common case — the row is on some other page —
// allocation-free. Every occurrence is replaced, not just the first: a list
// may legitimately hold the same track twice.
const replaceTrackRow = (nextTrack: Track) => (tracks: Track[]) => {
  if (!tracks.some(track => track.id === nextTrack.id)) return tracks;
  return tracks.map(track => (track.id === nextTrack.id ? nextTrack : track));
};

// A flat id lookup holds the same rows as a page; a row change reaches it too.
const patchTrackRowLists = (queryClient: QueryClient, nextTrack: Track) => {
  setQueriesDataIfPresent<Track[]>(queryClient, keyMatchers.trackRows, tracks =>
    Array.isArray(tracks) ? replaceTrackRow(nextTrack)(tracks) : tracks,
  );
};

const removeTracksFromInfinitePages = (
  data: TrackPages,
  trackIdSet: ReadonlySet<string>,
): TrackPages => {
  if (!isPagedData(data)) return data;
  let removedCount = 0;
  const pages = data.pages.map((page) => {
    const tracks = page.tracks.filter(track => !trackIdSet.has(track.id));
    removedCount += page.tracks.length - tracks.length;
    return { ...page, tracks };
  });
  if (removedCount === 0) return data;

  return {
    ...data,
    pages: recountOffsets(pages.map(page => ({
      ...page,
      total: Math.max(0, page.total - removedCount),
    })), trackRowsOf),
  };
};

const countTracksInInfinitePages = (data: TrackPages, added: number): TrackPages => {
  if (!isPagedData(data) || added === 0) return data;
  return {
    ...data,
    pages: data.pages.map(page => ({ ...page, total: page.total + added })),
  };
};

// New rows go at the end of the list, which is only cached once the last page
// is in. Until then the rows live on a page not yet read and only the total
// can be moved.
const appendTracksToInfinitePages = (data: TrackPages, tracks: readonly Track[]): TrackPages => {
  if (!isPagedData(data)) return data;
  const counted = countTracksInInfinitePages(data, tracks.length);
  const lastIndex = counted.pages.length - 1;
  if (lastIndex < 0 || counted.pages[lastIndex].nextOffset !== null) return counted;
  const lastPage = counted.pages[lastIndex];
  return {
    ...counted,
    pages: [
      ...counted.pages.slice(0, lastIndex),
      { ...lastPage, tracks: [...lastPage.tracks, ...tracks] },
    ],
  };
};

// The album is the artist's own, so the shelf's total drops even while its
// row sits on a page not yet read.
const removeAlbumFromInfinitePages = (
  data: InfiniteData<PaginatedAlbumsResult>,
  albumId: AlbumId,
): InfiniteData<PaginatedAlbumsResult> => {
  if (!isPagedData(data)) return data;
  return {
    ...data,
    pages: recountOffsets(data.pages.map(page => ({
      ...page,
      albums: page.albums.filter(album => album.id !== albumId),
      total: Math.max(0, page.total - 1),
    })), albumRowsOf),
  };
};

// The default liked order is likedAt desc, so a fresh like is the first row.
const patchInfiniteLikedPages = (data: TrackPages, nextTrack: Track): TrackPages => {
  if (!isPagedData(data)) return data;
  const totalDelta = nextTrack.isLiked ? 1 : -1;

  return {
    ...data,
    pages: recountOffsets(data.pages.map((page, index) => {
      const withoutCurrent = page.tracks.filter(track => track.id !== nextTrack.id);

      return {
        ...page,
        tracks: nextTrack.isLiked && index === 0 ? [nextTrack, ...withoutCurrent] : withoutCurrent,
        total: Math.max(0, page.total + totalDelta),
      };
    }), trackRowsOf),
  };
};

const LIBRARY_ROOTS: ReadonlySet<unknown> = new Set([
  "library",
  "tracks",
  "albums",
  "artists",
  "playlists",
]);

const isLibraryRead = (query: Query) => LIBRARY_ROOTS.has(query.queryKey[0]);

/**
 * Cancels every library read still in flight and re-issues the mounted ones.
 * Call right after a mutation's last Dexie write and before its point-sync:
 * a read that started before the write answers with the pre-write rows and
 * would land on top of the patch. Invalidation alone does not cover that —
 * its refetch joins a read that has no data yet and clears `isInvalidated`
 * on the stale answer. Remote and stats roots are left alone: the former are
 * network requests, the latter share one `fetchQuery` whose cancellation
 * would surface as an error in every aggregate awaiting it.
 */
export const settleLibraryReads = async (queryClient: QueryClient): Promise<void> => {
  const overlapped = new Set(
    queryClient.getQueryCache().findAll({ predicate: isLibraryRead, fetchStatus: "fetching" }),
  );
  if (overlapped.size === 0) return;

  // A refetch re-reads the loaded pages only. A list cancelled mid
  // `fetchNextPage` keeps its row count, and the scroller asks for more
  // again only once that count changes — so the page it wanted is fetched
  // for it once the loaded ones are back.
  const nextPages = [...overlapped].flatMap((query) => {
    const fetchMore = query.state.fetchMeta?.fetchMore;
    return fetchMore ? [[query, fetchMore] as const] : [];
  });

  const filter = { predicate: (query: Query) => overlapped.has(query) };
  await queryClient.cancelQueries(filter);
  queryClient.refetchQueries({ ...filter, type: "active" })
    .then(() => {
      for (const [query, fetchMore] of nextPages) {
        if (query.isActive()) query.fetch(undefined, { meta: { fetchMore } }).catch(() => {});
      }
    })
    .catch(() => {});
};

export const syncArtistCaches = (queryClient: QueryClient, artist: ArtistEntity) => {
  queryClient.setQueryData(queryKeys.artists.detail(artist.id), artist);
  setQueryDataIfPresent<LibrarySummaryData>(
    queryClient,
    queryKeys.library.summary(),
    data => ({
      ...data,
      artists: upsertById(data.artists, artist),
    }),
  );
};

/** Drops the artist from the summary and every key cached under its id. */
export const removeArtistCaches = (queryClient: QueryClient, artistId: ArtistId) => {
  setQueryDataIfPresent<LibrarySummaryData>(
    queryClient,
    queryKeys.library.summary(),
    data => ({
      ...data,
      artists: removeById(data.artists, artistId),
    }),
  );
  queryClient.removeQueries({ queryKey: queryKeys.artists.detail(artistId) });
};

export const syncAlbumCaches = (queryClient: QueryClient, album: AlbumEntity) => {
  queryClient.setQueryData(queryKeys.albums.detail(album.id), album);
  setQueryDataIfPresent<LibrarySummaryData>(
    queryClient,
    queryKeys.library.summary(),
    data => ({
      ...data,
      albums: upsertById(data.albums, album),
    }),
  );
};

/** Drops the album from its artist's shelf, the summary and every key cached under its id. */
export const removeAlbumCaches = (
  queryClient: QueryClient,
  albumId: AlbumId,
  artistId: ArtistId,
) => {
  setQueryDataIfPresent<InfiniteData<PaginatedAlbumsResult>>(
    queryClient,
    queryKeys.artists.albums(artistId),
    data => removeAlbumFromInfinitePages(data, albumId),
  );
  setQueryDataIfPresent<LibrarySummaryData>(
    queryClient,
    queryKeys.library.summary(),
    data => ({
      ...data,
      albums: removeById(data.albums, albumId),
    }),
  );
  queryClient.removeQueries({ queryKey: queryKeys.albums.detail(albumId) });
};

export const syncPlaylistCaches = (queryClient: QueryClient, playlist: PlaylistEntity) => {
  setQueryDataIfPresent<PlaylistEntity[]>(queryClient, queryKeys.playlists.all(), playlists =>
    upsertById(playlists, playlist),
  );
  queryClient.setQueryData(queryKeys.playlists.detail(playlist.id), playlist);
  setQueryDataIfPresent<LibrarySummaryData>(
    queryClient,
    queryKeys.library.summary(),
    data => ({
      ...data,
      playlists: upsertById(data.playlists, playlist),
    }),
  );
};

/** Drops the playlist from the lists, the summary and every key cached under its id. */
export const removePlaylistCaches = (queryClient: QueryClient, playlistId: PlaylistId) => {
  setQueryDataIfPresent<PlaylistEntity[]>(queryClient, queryKeys.playlists.all(), playlists =>
    removeById(playlists, playlistId),
  );
  setQueryDataIfPresent<LibrarySummaryData>(
    queryClient,
    queryKeys.library.summary(),
    data => ({
      ...data,
      playlists: removeById(data.playlists, playlistId),
    }),
  );
  queryClient.removeQueries({ queryKey: queryKeys.playlists.detail(playlistId) });
};

/** The owner's cover row was written (`null`: deleted); publishes it without a re-read. */
export const updateCoverCache = (
  ownerType: CoverOwnerType,
  ownerId: string,
  row: CoverRow | null,
) => {
  coverCache.set({ ownerType, ownerId }, row);
};

/** A cover row is gone (its owner was deleted or re-parented). */
export const removeCoverCache = (ownerType: CoverOwnerType, ownerId: string) => {
  coverCache.invalidate({ ownerType, ownerId });
};

// ── Paged track lists ─────────────────────────────────────────────────────

/** Drops the rows from every loaded page of the playlist, whatever its sort. */
export const syncPlaylistTracksRemoval = (
  queryClient: QueryClient,
  playlistId: PlaylistId,
  trackIds: ReadonlySet<string>,
) => {
  setQueriesDataIfPresent<TrackPages>(
    queryClient,
    keyMatchers.tracksPagesOfEntity("playlists", playlistId),
    data => removeTracksFromInfinitePages(data, trackIds),
  );
};

/**
 * Appends the rows to the playlist's own order, where they are known to go
 * last; a sorted page only learns the new total and is re-read for the rows.
 * `tracks` must be the rows the repository actually appended (no duplicates).
 */
export const syncPlaylistTracksAddition = (
  queryClient: QueryClient,
  playlistId: PlaylistId,
  tracks: readonly Track[],
) => {
  if (tracks.length === 0) return;
  setQueryDataIfPresent<TrackPages>(
    queryClient,
    queryKeys.playlists.tracksPage(playlistId),
    data => appendTracksToInfinitePages(data, tracks),
  );
  setQueriesDataIfPresent<TrackPages>(
    queryClient,
    keyMatchers.sortedTracksPagesOfEntity("playlists", playlistId),
    data => countTracksInInfinitePages(data, tracks.length),
  );
};

// The liked count and duration are cached aggregates; a deleted liked row's
// share is only known from the liked pages loaded so far. A liked track
// deleted before its page was read leaves both alone until the re-read.
// Returns duration by id, one entry per liked row found.
const likedRowsAmong = (queryClient: QueryClient, trackIdSet: ReadonlySet<string>): ReadonlyMap<string, number> => {
  const durationById = new Map<string, number>();
  for (const [, data] of queryClient.getQueriesData<TrackPages>({ predicate: query => keyMatchers.likedPages(query.queryKey) })) {
    if (!data || !isPagedData(data)) continue;
    for (const page of data.pages) {
      for (const track of page.tracks) {
        if (trackIdSet.has(track.id)) durationById.set(track.id, track.duration);
      }
    }
  }
  return durationById;
};

/** Drops the rows from every loaded page of every track list in one pass over the cache. */
export const removeTracksFromCaches = (
  queryClient: QueryClient,
  trackIds: readonly string[],
) => {
  markRecommenderContextDirty();
  const trackIdSet = new Set(trackIds);
  const likedRows = likedRowsAmong(queryClient, trackIdSet);

  setQueriesDataIfPresent<TrackPages>(
    queryClient,
    keyMatchers.trackPages,
    data => removeTracksFromInfinitePages(data, trackIdSet),
  );
  patchLikedAggregates(
    queryClient,
    -likedRows.size,
    -[...likedRows.values()].reduce((sum, duration) => sum + duration, 0),
  );
};

const patchStatsTrackCaches = (
  queryClient: QueryClient,
  nextTrackEntity: TrackEntity,
  nextTrack: Track,
) => {
  setQueriesDataIfPresent<{ track: Track }[]>(
    queryClient,
    key => key[0] === "stats" && (key[1] === "topTracks" || key[1] === "recentHistory"),
    entries => entries.map(entry =>
      entry.track.id === nextTrack.id ? { ...entry, track: nextTrack } : entry,
    ),
  );

  setQueriesDataIfPresent<TrackEntity[]>(
    queryClient,
    key => key[0] === "stats" && key[1] === "topTracksMeta",
    tracks => tracks.map(track =>
      track.id === nextTrackEntity.id ? nextTrackEntity : track,
    ),
  );
};

/**
 * A like moves the row into (or out of) the default liked page and flips it
 * in place everywhere else. A sorted liked page cannot place the row — see
 * `invalidateForTrackMutation("like")`.
 */
export const syncTrackLikeCaches = (
  queryClient: QueryClient,
  nextTrackEntity: TrackEntity,
  nextTrack: Track,
) => {
  markRecommenderContextDirty();
  const sign = nextTrack.isLiked ? 1 : -1;

  patchStatsTrackCaches(queryClient, nextTrackEntity, nextTrack);
  queryClient.setQueryData(queryKeys.tracks.detail(nextTrackEntity.id), nextTrackEntity);

  patchLikedAggregates(queryClient, sign, sign * nextTrack.duration);
  setQueriesDataIfPresent<TrackPages>(
    queryClient,
    keyMatchers.likedDefaultPage,
    data => patchInfiniteLikedPages(data, nextTrack),
  );
  setQueriesDataIfPresent<TrackPages>(
    queryClient,
    key => keyMatchers.trackPages(key) && !keyMatchers.likedPages(key),
    data => mapInfiniteTrackPages(data, replaceTrackRow(nextTrack)),
  );
  patchTrackRowLists(queryClient, nextTrack);
};

/** Replaces the row wherever it is loaded; a list whose order the change may affect is re-read by the caller. */
export const syncTrackMetadataCaches = (
  queryClient: QueryClient,
  nextTrackEntity: TrackEntity,
  nextTrack: Track,
) => {
  markRecommenderContextDirty();
  queryClient.setQueryData(queryKeys.tracks.detail(nextTrackEntity.id), nextTrackEntity);
  patchStatsTrackCaches(queryClient, nextTrackEntity, nextTrack);
  setQueriesDataIfPresent<TrackPages>(
    queryClient,
    keyMatchers.trackPages,
    data => mapInfiniteTrackPages(data, replaceTrackRow(nextTrack)),
  );
  patchTrackRowLists(queryClient, nextTrack);
};

// ── Invalidation registry ─────────────────────────────────────────────────
// Each affected-key group is named once; invalidateFor*Mutation composes
// them per mutation kind. Rows carry denormalized names (artist, albumName),
// so a rename reaches every paged track list, not only the entity's own.

type InvalidationFilter = InvalidateQueryFilters;

const byKey = (queryKey: readonly unknown[]): InvalidationFilter => ({ queryKey });

const byMatch = (match: QueryKeyMatch): InvalidationFilter => ({
  predicate: query => match(query.queryKey),
});

const affectedKeys = {
  library: {
    summary: (): InvalidationFilter[] => [byKey(queryKeys.library.summary())],
  },
  tracks: {
    /** Every track read: the index and liked pages, the rows, the id lookups, the pickers' search. */
    all: (): InvalidationFilter[] => [byKey(queryKeys.tracks.all())],
    likedSortedPages: (): InvalidationFilter[] => [byMatch(keyMatchers.likedSortedPages)],
  },
  albums: {
    all: (): InvalidationFilter[] => [byKey(queryKeys.albums.all())],
    /** Everything cached under these albums. */
    of: (ids: readonly AlbumId[]): InvalidationFilter[] => ids.map(id => byKey(queryKeys.albums.detail(id))),
    /**
     * An album's listings: the pages and the id order they are cut from. The
     * order has to go with them — pages re-read against a stale order report
     * a total that still counts removed rows and serve short pages.
     */
    tracksPages: (): InvalidationFilter[] => [
      byMatch(keyMatchers.tracksPagesOf("albums")),
      byMatch(keyMatchers.trackOrdersOf("albums")),
    ],
  },
  artists: {
    all: (): InvalidationFilter[] => [byKey(queryKeys.artists.all())],
    /** Everything cached under these artists, their album shelves included. */
    of: (ids: readonly ArtistId[]): InvalidationFilter[] => ids.map(id => byKey(queryKeys.artists.detail(id))),
    /** The album rows the artist page renders; nothing patches a title into them. */
    albumShelves: (ids: readonly ArtistId[]): InvalidationFilter[] => ids.map(id => byKey(queryKeys.artists.albums(id))),
    /** The pages and the id order they are cut from — see albums.tracksPages. */
    tracksPages: (): InvalidationFilter[] => [
      byMatch(keyMatchers.tracksPagesOf("artists")),
      byMatch(keyMatchers.trackOrdersOf("artists")),
    ],
  },
  playlists: {
    all: (): InvalidationFilter[] => [byKey(queryKeys.playlists.all())],
    /** Everything cached under these playlists. */
    of: (ids: readonly PlaylistId[]): InvalidationFilter[] => ids.map(id => byKey(queryKeys.playlists.detail(id))),
    tracksPages: (): InvalidationFilter[] => [byMatch(keyMatchers.tracksPagesOf("playlists"))],
  },
} as const;

/**
 * Marks the filters stale at once; the re-read of mounted queries runs in
 * the background. A mutation does not wait for it: the point-sync already
 * shows the change, and a re-read of every loaded page of every mounted list
 * would otherwise hold `isPending` (and any navigation chained on it) for
 * as long as the slowest list.
 */
const runInvalidations = (queryClient: QueryClient, filters: InvalidationFilter[]) => {
  for (const filter of filters) queryClient.invalidateQueries(filter).catch(() => {});
};

export type TrackMutationCtx
  = | { kind: "relations" }
    | { kind: "like" }
    | { kind: "metadata"; artistIds: readonly ArtistId[]; albumIds: readonly AlbumId[] }
    | {
      kind: "removal";
      albumIds: readonly AlbumId[];
      artistIds: readonly ArtistId[];
      playlistIds: readonly PlaylistId[];
    };

export const invalidateForTrackMutation = (queryClient: QueryClient, ctx: TrackMutationCtx) => {
  markRecommenderContextDirty();
  switch (ctx.kind) {
    case "like":
      return runInvalidations(queryClient, affectedKeys.tracks.likedSortedPages());
    case "relations":
      // add-to-album / add-to-artist / bulk favorite: every list may move.
      return runInvalidations(queryClient, [
        ...affectedKeys.library.summary(),
        ...affectedKeys.tracks.all(),
        ...affectedKeys.albums.all(),
        ...affectedKeys.artists.all(),
        ...affectedKeys.playlists.all(),
      ]);
    case "metadata":
      // The summary carries per-album and per-artist track counts.
      return runInvalidations(queryClient, [
        ...affectedKeys.library.summary(),
        ...affectedKeys.tracks.all(),
        ...affectedKeys.artists.of(ctx.artistIds),
        ...affectedKeys.albums.of(ctx.albumIds),
        ...affectedKeys.playlists.tracksPages(),
      ]);
    case "removal":
      // The album and artist roots cover every per-id key at once; a
      // whole-library delete would otherwise scan the cache once per id.
      return runInvalidations(queryClient, [
        ...affectedKeys.library.summary(),
        ...affectedKeys.tracks.all(),
        ...affectedKeys.albums.all(),
        ...affectedKeys.artists.all(),
        ...affectedKeys.playlists.of(ctx.playlistIds),
      ]);
  }
};

// `playlistIds` of a removal: the playlists a cascade delete dropped rows
// from. Their duration sums are aggregates the point-sync cannot move.
export type AlbumMutationCtx
  = | { kind: "titleChange"; albumId: AlbumId; artistId: ArtistId }
    | { kind: "creation"; artistId: ArtistId }
    | { kind: "removal"; artistId: ArtistId; playlistIds: readonly PlaylistId[] };

export const invalidateForAlbumMutation = (queryClient: QueryClient, ctx: AlbumMutationCtx) => {
  switch (ctx.kind) {
    case "titleChange":
      return runInvalidations(queryClient, [
        ...affectedKeys.tracks.all(),
        ...affectedKeys.albums.of([ctx.albumId]),
        ...affectedKeys.artists.albumShelves([ctx.artistId]),
        ...affectedKeys.artists.tracksPages(),
        ...affectedKeys.playlists.tracksPages(),
      ]);
    case "creation":
      return runInvalidations(queryClient, [
        ...affectedKeys.artists.of([ctx.artistId]),
      ]);
    case "removal":
      return runInvalidations(queryClient, [
        ...affectedKeys.library.summary(),
        ...affectedKeys.tracks.all(),
        ...affectedKeys.artists.of([ctx.artistId]),
        ...affectedKeys.playlists.of(ctx.playlistIds),
        ...affectedKeys.playlists.tracksPages(),
      ]);
  }
};

export type ArtistMutationCtx
  = | { kind: "change"; artistId: ArtistId }
    | { kind: "removal"; playlistIds: readonly PlaylistId[] };

export const invalidateForArtistMutation = (queryClient: QueryClient, ctx: ArtistMutationCtx) => {
  switch (ctx.kind) {
    case "change":
      return runInvalidations(queryClient, [
        ...affectedKeys.tracks.all(),
        ...affectedKeys.artists.of([ctx.artistId]),
        ...affectedKeys.albums.tracksPages(),
        ...affectedKeys.playlists.tracksPages(),
      ]);
    case "removal":
      // The artist's own albums were removed from the cache by the caller.
      // Tracks credited to a second artist keep that one, on that artist's
      // album: those pages carry the joined artist name and change too.
      return runInvalidations(queryClient, [
        ...affectedKeys.library.summary(),
        ...affectedKeys.tracks.all(),
        ...affectedKeys.albums.tracksPages(),
        ...affectedKeys.artists.tracksPages(),
        ...affectedKeys.playlists.of(ctx.playlistIds),
        ...affectedKeys.playlists.tracksPages(),
      ]);
  }
};

export type PlaylistMutationCtx = { kind: "tracksChange"; playlistId: PlaylistId };

export const invalidateForPlaylistMutation = (queryClient: QueryClient, ctx: PlaylistMutationCtx) => {
  runInvalidations(queryClient, affectedKeys.playlists.of([ctx.playlistId]));
};
