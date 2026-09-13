import { describe, expect, it } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/vue-query";
import {
  invalidateForAlbumMutation,
  invalidateForArtistMutation,
  invalidateForPlaylistMutation,
  invalidateForTrackMutation,
} from "../cache";
import { queryKeys } from "../query-keys";
import { AlbumId, ArtistId, PlaylistId, TrackId } from "@/types/ids";

const seed = (keys: readonly (readonly unknown[])[]) => {
  const queryClient = new QueryClient();
  for (const key of keys) queryClient.setQueryData(key, {});
  return queryClient;
};

const isInvalidated = (queryClient: QueryClient, key: readonly unknown[]) =>
  queryClient.getQueryState(key)?.isInvalidated === true;

const expectStale = (queryClient: QueryClient, keys: readonly (readonly unknown[])[]) => {
  for (const key of keys) expect(isInvalidated(queryClient, key), String(key)).toBe(true);
};

const albumId = AlbumId("al-1");
const artistId = ArtistId("a-1");
const playlistId = PlaylistId("pl-1");

// The rows a page renders carry denormalized names (artist, albumName), so a
// rename anywhere has to reach every paged track list, not only the renamed
// entity's own pages.
const pagedTrackLists = [
  queryKeys.albums.tracksPage(albumId),
  queryKeys.albums.tracksPage(albumId, "title_asc"),
  queryKeys.artists.tracksPage(artistId),
  queryKeys.playlists.tracksPage(playlistId),
  queryKeys.playlists.tracksPage(playlistId, "title_asc"),
  queryKeys.tracks.indexInfinite("date_added_desc"),
  queryKeys.tracks.likedPageInfinite(),
  queryKeys.tracks.byIds([TrackId("t-1")]),
  queryKeys.tracks.detail(TrackId("t-1")),
];

describe("invalidateForTrackMutation: removal", () => {
  const likedKeys = [
    queryKeys.tracks.likedPageInfinite(),
    queryKeys.tracks.likedPageInfinite("title_asc"),
    queryKeys.tracks.likedTotalDuration(),
  ];

  it("marks every liked page, whatever its sort, and the liked duration stale", async () => {
    const queryClient = seed(likedKeys);

    await invalidateForTrackMutation(queryClient, {
      kind: "removal",
      albumIds: [],
      artistIds: [],
      playlistIds: [],
    });

    expectStale(queryClient, likedKeys);
  });
});

describe("invalidateForTrackMutation: metadata", () => {
  it("reaches every paged list, the id lookups and the summary counts", async () => {
    const keys = [...pagedTrackLists, queryKeys.library.summary()];
    const queryClient = seed(keys);

    await invalidateForTrackMutation(queryClient, { kind: "metadata", artistIds: [artistId], albumIds: [albumId] });

    expectStale(queryClient, keys);
  });
});

describe("invalidateForPlaylistMutation", () => {
  it("marks everything cached under the playlist stale", async () => {
    const keys = [
      queryKeys.playlists.detail(playlistId),
      queryKeys.playlists.tracksPage(playlistId, "title_asc"),
      queryKeys.playlists.totalDuration(playlistId),
    ];
    const queryClient = seed(keys);

    await invalidateForPlaylistMutation(queryClient, { kind: "tracksChange", playlistId });

    expectStale(queryClient, keys);
  });
});

describe("invalidateForTrackMutation: like", () => {
  // The default (likedAt desc) page is patched in place; a sorted page cannot
  // be — the row's position depends on the sort — so it is re-read instead.
  it("marks the sorted liked pages stale and leaves the default one alone", async () => {
    const sorted = queryKeys.tracks.likedPageInfinite("title_asc");
    const byDefault = queryKeys.tracks.likedPageInfinite();
    const queryClient = seed([sorted, byDefault]);

    await invalidateForTrackMutation(queryClient, { kind: "like" });

    expect(isInvalidated(queryClient, sorted)).toBe(true);
    expect(isInvalidated(queryClient, byDefault)).toBe(false);
  });
});

describe("invalidateForArtistMutation: change", () => {
  it("reaches the paged track lists of albums and playlists, whose rows carry the artist name", async () => {
    const queryClient = seed(pagedTrackLists);

    await invalidateForArtistMutation(queryClient, { kind: "change", artistId });

    expectStale(queryClient, pagedTrackLists);
  });
});

describe("invalidateForAlbumMutation: titleChange", () => {
  it("reaches the paged track lists of artists and playlists, whose rows carry the album title", async () => {
    const queryClient = seed(pagedTrackLists);

    await invalidateForAlbumMutation(queryClient, { kind: "titleChange", albumId });

    expectStale(queryClient, pagedTrackLists);
  });
});

describe("invalidation does not hold the mutation", () => {
  // The point-sync already shows the change; the re-read of every mounted
  // list runs behind it. A mutation that waited for it would keep isPending
  // (and a navigation chained on it) up for as long as the longest re-read.
  it("resolves while a mounted list is still re-reading", async () => {
    const queryClient = new QueryClient();
    const key = queryKeys.tracks.indexInfinite("date_added_desc");
    queryClient.setQueryData(key, {});
    const observer = new QueryObserver(queryClient, {
      queryKey: key,
      queryFn: () => new Promise<never>(() => {}),
      staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(() => {});

    const settled = await Promise.race([
      Promise.resolve(invalidateForTrackMutation(queryClient, { kind: "relations" })).then(() => "settled"),
      new Promise(resolve => setTimeout(() => resolve("timed out"), 50)),
    ]);

    expect(settled).toBe("settled");
    expect(isInvalidated(queryClient, key)).toBe(true);
    expect(queryClient.isFetching({ queryKey: key })).toBe(1);
    unsubscribe();
  });
});
