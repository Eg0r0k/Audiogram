import { describe, expect, it, vi } from "vitest";
import { QueryClient, type InfiniteData } from "@tanstack/vue-query";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import type { Track } from "@/modules/player/types";
import { AlbumId, ArtistId, PlaylistId, TrackId } from "@/types/ids";
import { keyMatchers, queryKeys } from "../query-keys";
import {
  removeAlbumCaches,
  removeArtistCaches,
  removePlaylistCaches,
  removeTracksFromCaches,
  syncPlaylistTracksAddition,
  syncPlaylistTracksRemoval,
  syncTrackLikeCaches,
  syncTrackMetadataCaches,
} from "../cache";
import type { PaginatedTracksResult } from "../types";

const albumId = AlbumId("al-1");
const artistId = ArtistId("a-1");
const playlistId = PlaylistId("pl-1");

const row = (id: string): Track => ({
  id: TrackId(id),
  kind: "library",
  title: id,
  artist: "Local",
  artistIds: [artistId],
  albumId,
  albumName: "Album",
  storagePath: "p",
  source: TrackSource.LOCAL_INTERNAL,
  state: TrackState.READY,
  duration: 10,
  isLiked: false,
});

type Pages = InfiniteData<PaginatedTracksResult>;

const pages = (...ids: string[][]): Pages => {
  const total = ids.flat().length;
  let offset = 0;
  return {
    pages: ids.map((pageIds) => {
      offset += pageIds.length;
      return { tracks: pageIds.map(row), nextOffset: offset < total ? offset : null, total };
    }),
    pageParams: ids.map((_, index) => index * 2),
  };
};

const rowIds = (data: Pages | undefined) => data?.pages.map(page => page.tracks.map(track => track.id)) ?? [];

describe("removing an entity drops everything cached under its id", () => {
  it("album: detail, the row lookup, its paged tracks and its duration", () => {
    const queryClient = new QueryClient();
    const keys = [
      queryKeys.albums.detail(albumId),
      queryKeys.albums.libraryRow(albumId),
      queryKeys.albums.tracksPage(albumId, "title_asc"),
      queryKeys.albums.totalDuration(albumId),
    ];
    for (const key of keys) queryClient.setQueryData(key, {});

    removeAlbumCaches(queryClient, albumId, artistId);

    for (const key of keys) expect(queryClient.getQueryData(key), String(key)).toBeUndefined();
  });

  it("artist: detail, the row lookup, its paged tracks and its paged albums", () => {
    const queryClient = new QueryClient();
    const keys = [
      queryKeys.artists.detail(artistId),
      queryKeys.artists.libraryRow(artistId),
      queryKeys.artists.tracksPage(artistId),
      queryKeys.artists.albums(artistId),
    ];
    for (const key of keys) queryClient.setQueryData(key, {});

    removeArtistCaches(queryClient, artistId);

    for (const key of keys) expect(queryClient.getQueryData(key), String(key)).toBeUndefined();
  });

  it("playlist: detail, the row lookup, its paged tracks and its duration", () => {
    const queryClient = new QueryClient();
    const keys = [
      queryKeys.playlists.detail(playlistId),
      queryKeys.playlists.libraryRow(playlistId),
      queryKeys.playlists.tracksPage(playlistId, "title_asc"),
      queryKeys.playlists.totalDuration(playlistId),
    ];
    for (const key of keys) queryClient.setQueryData(key, {});

    removePlaylistCaches(queryClient, playlistId);

    for (const key of keys) expect(queryClient.getQueryData(key), String(key)).toBeUndefined();
  });
});

describe("removeTracksFromCaches", () => {
  const seed = () => {
    const queryClient = new QueryClient();
    const keys = [
      queryKeys.tracks.indexInfinite("date_added_desc"),
      queryKeys.tracks.likedPageInfinite("title_asc"),
      queryKeys.albums.tracksPage(albumId),
      queryKeys.artists.tracksPage(artistId, "title_asc"),
      queryKeys.playlists.tracksPage(playlistId),
      queryKeys.playlists.tracksPage(playlistId, "title_asc"),
    ];
    for (const key of keys) queryClient.setQueryData(key, pages(["t-1", "t-2"], ["t-3", "t-4"]));
    return { queryClient, keys };
  };

  it("drops the rows from every paged track list and moves the offsets back", () => {
    const { queryClient, keys } = seed();

    removeTracksFromCaches(queryClient, [TrackId("t-2"), TrackId("t-3")]);

    for (const key of keys) {
      const data = queryClient.getQueryData<Pages>(key);
      expect(rowIds(data), String(key)).toEqual([["t-1"], ["t-4"]]);
      expect(data?.pages[0]?.nextOffset).toBe(1);
      expect(data?.pages[0]?.total).toBe(2);
    }
  });

  it("walks the cache once, however many rows and playlists are involved", () => {
    const { queryClient } = seed();
    const setQueriesData = vi.spyOn(queryClient, "setQueriesData");

    removeTracksFromCaches(queryClient, ["t-1", "t-2", "t-3", "t-4"].map(TrackId));

    expect(setQueriesData).toHaveBeenCalledTimes(1);
  });
});

describe("playlist point-sync of its paged tracks", () => {
  it("removal reaches every sort of the playlist and no other playlist", () => {
    const queryClient = new QueryClient();
    const other = PlaylistId("pl-2");
    const keys = [
      queryKeys.playlists.tracksPage(playlistId),
      queryKeys.playlists.tracksPage(playlistId, "title_asc"),
    ];
    for (const key of [...keys, queryKeys.playlists.tracksPage(other)]) {
      queryClient.setQueryData(key, pages(["t-1", "t-2"], ["t-3"]));
    }

    syncPlaylistTracksRemoval(queryClient, playlistId, new Set(["t-1", "t-3"]));

    for (const key of keys) {
      expect(rowIds(queryClient.getQueryData<Pages>(key)), String(key)).toEqual([["t-2"], []]);
    }
    expect(rowIds(queryClient.getQueryData<Pages>(queryKeys.playlists.tracksPage(other)))).toEqual([["t-1", "t-2"], ["t-3"]]);
  });

  it("addition appends to the fully loaded playlist order and only counts on a sorted page", () => {
    const queryClient = new QueryClient();
    const byOrder = queryKeys.playlists.tracksPage(playlistId);
    const sorted = queryKeys.playlists.tracksPage(playlistId, "title_asc");
    queryClient.setQueryData(byOrder, pages(["t-1"]));
    queryClient.setQueryData(sorted, pages(["t-1"]));

    syncPlaylistTracksAddition(queryClient, playlistId, [row("t-2")]);

    expect(rowIds(queryClient.getQueryData<Pages>(byOrder))).toEqual([["t-1", "t-2"]]);
    expect(queryClient.getQueryData<Pages>(byOrder)?.pages[0]?.total).toBe(2);
    expect(rowIds(queryClient.getQueryData<Pages>(sorted))).toEqual([["t-1"]]);
    expect(queryClient.getQueryData<Pages>(sorted)?.pages[0]?.total).toBe(2);
  });

  it("addition only counts while later pages of the order are still unloaded", () => {
    const queryClient = new QueryClient();
    const byOrder = queryKeys.playlists.tracksPage(playlistId);
    queryClient.setQueryData(byOrder, pages(["t-1", "t-2"], ["t-3", "t-4"], ["t-5"]));
    const partial = queryClient.getQueryData<Pages>(byOrder)!;
    queryClient.setQueryData(byOrder, { ...partial, pages: partial.pages.slice(0, 1) });

    syncPlaylistTracksAddition(queryClient, playlistId, [row("t-6")]);

    const data = queryClient.getQueryData<Pages>(byOrder);
    expect(rowIds(data)).toEqual([["t-1", "t-2"]]);
    expect(data?.pages[0]?.total).toBe(6);
    expect(data?.pages[0]?.nextOffset).toBe(2);
  });
});

describe("flat row lists (tracks.byIds)", () => {
  const entity = (id: string, likedAt?: number): TrackEntity => ({
    id: TrackId(id),
    title: id,
    artistIds: [artistId],
    albumId,
    tagIds: [],
    duration: 10,
    source: TrackSource.LOCAL_INTERNAL,
    storagePath: "p",
    state: TrackState.READY,
    format: {},
    playCount: 0,
    likedAt,
    addedAt: 0,
  });

  it("a like flips the row in every byIds list that holds it", () => {
    const queryClient = new QueryClient();
    const held = queryKeys.tracks.byIds([TrackId("t1"), TrackId("t2")]);
    const other = queryKeys.tracks.byIds([TrackId("t3")]);
    queryClient.setQueryData(held, [row("t1"), row("t2")]);
    queryClient.setQueryData(other, [row("t3")]);

    syncTrackLikeCaches(queryClient, entity("t2", 1), { ...row("t2"), isLiked: true });

    expect(queryClient.getQueryData<Track[]>(held)?.map(track => track.isLiked)).toEqual([false, true]);
    expect(queryClient.getQueryData<Track[]>(other)?.map(track => track.isLiked)).toEqual([false]);
  });

  it("a metadata edit replaces the row in a byIds list", () => {
    const queryClient = new QueryClient();
    const held = queryKeys.tracks.byIds([TrackId("t1")]);
    queryClient.setQueryData(held, [row("t1")]);

    syncTrackMetadataCaches(queryClient, { ...entity("t1"), title: "Renamed" }, { ...row("t1"), title: "Renamed" });

    expect(queryClient.getQueryData<Track[]>(held)?.[0]?.title).toBe("Renamed");
  });
});

describe("search-scoped collection pages", () => {
  it("the key carries the search after the sort", () => {
    expect(queryKeys.playlists.tracksPage(playlistId)).toEqual(["playlists", playlistId, "tracks", "page"]);
    expect(queryKeys.playlists.tracksPage(playlistId, null, "abba")).toEqual(["playlists", playlistId, "tracks", "page", "search", "abba"]);
    expect(queryKeys.albums.tracksPage(albumId, "title_asc", "abba")).toEqual(["albums", albumId, "tracks", "page", "title_asc", "search", "abba"]);
    expect(keyMatchers.searchScopedPages(queryKeys.albums.tracksPage(albumId, "title_asc", "abba"))).toBe(true);
    expect(keyMatchers.searchScopedPages(queryKeys.albums.tracksPage(albumId, "title_asc"))).toBe(false);
  });

  it("an addition is not counted into a filtered page", () => {
    const queryClient = new QueryClient();
    const sorted = queryKeys.playlists.tracksPage(playlistId, "title_asc");
    const filtered = queryKeys.playlists.tracksPage(playlistId, "title_asc", "abba");
    queryClient.setQueryData(sorted, pages(["t1"]));
    queryClient.setQueryData(filtered, pages(["t1"]));

    syncPlaylistTracksAddition(queryClient, playlistId, [row("t2")]);

    expect(queryClient.getQueryData<Pages>(sorted)?.pages[0]?.total).toBe(2);
    expect(queryClient.getQueryData<Pages>(filtered)?.pages[0]?.total).toBe(1);
  });
});

describe("search-scoped liked pages", () => {
  it("the liked key carries the search and is recognised as scoped", () => {
    expect(queryKeys.tracks.likedPageInfinite(null, "abba")).toEqual(["tracks", "liked", "page", "infinite", "search", "abba"]);
    expect(keyMatchers.searchScopedPages(queryKeys.tracks.likedPageInfinite("title_asc", "abba"))).toBe(true);
    expect(keyMatchers.searchScopedPages(queryKeys.tracks.likedPageInfinite("title_asc"))).toBe(false);
    expect(keyMatchers.likedDefaultPage(queryKeys.tracks.likedPageInfinite(null, "abba"))).toBe(false);
  });
});
