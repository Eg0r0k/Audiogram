import { describe, expect, it } from "vitest";
import { QueryClient, type InfiniteData } from "@tanstack/vue-query";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import type { Track } from "@/modules/player/types";
import { AlbumId, ArtistId, TrackId } from "@/types/ids";
import { queryKeys } from "../query-keys";
import { syncTrackLikeCaches, syncTrackMetadataCaches } from "../cache";
import type { PaginatedTracksResult } from "../types";

//
// A page patch touches one row, and must build only what it touched.
//
// Structural sharing is deliberately off here: it would restore the identity
// of everything the patch rebuilt for nothing, hiding the cost behind a deep
// walk of every loaded row — which is itself the cost. What these pin down is
// what the patch hands back, so patching one row of a list scrolled deep into
// a large library stays proportional to that row, not to the list.
//

const albumId = AlbumId("al-1");
const artistId = ArtistId("a-1");

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

const entity = (id: string): TrackEntity => ({
  id: TrackId(id),
  title: id,
  artistName: "Local",
  albumTitle: "Album",
  artistIds: [artistId],
  albumId,
  tagIds: [],
  source: TrackSource.LOCAL_INTERNAL,
  pinned: 1,
  state: TrackState.READY,
  storagePath: "p",
  duration: 10,
  format: {},
  playCount: 0,
  addedAt: 1,
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
    pageParams: ids.map((_, index) => index),
  };
};

const indexKey = queryKeys.tracks.indexInfinite(null, "");

const seed = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { structuralSharing: false } },
  });
  queryClient.setQueryData(indexKey, pages(["t-1", "t-2"], ["t-3", "t-4"], ["t-5", "t-6"]));
  return { queryClient, before: queryClient.getQueryData<Pages>(indexKey)! };
};

describe("syncTrackLikeCaches", () => {
  it("replaces only the page holding the track", () => {
    const { queryClient, before } = seed();

    syncTrackLikeCaches(queryClient, entity("t-3"), { ...row("t-3"), isLiked: true });

    const after = queryClient.getQueryData<Pages>(indexKey)!;
    expect(after.pages[0]).toBe(before.pages[0]);
    expect(after.pages[2]).toBe(before.pages[2]);
    expect(after.pages[1]).not.toBe(before.pages[1]);
  });

  it("replaces only the row that changed inside that page", () => {
    const { queryClient, before } = seed();

    syncTrackLikeCaches(queryClient, entity("t-3"), { ...row("t-3"), isLiked: true });

    const after = queryClient.getQueryData<Pages>(indexKey)!;
    expect(after.pages[1].tracks[0].isLiked).toBe(true);
    expect(after.pages[1].tracks[1]).toBe(before.pages[1].tracks[1]);
  });
});

describe("syncTrackMetadataCaches", () => {
  it("replaces only the page holding the track", () => {
    const { queryClient, before } = seed();

    syncTrackMetadataCaches(queryClient, entity("t-5"), { ...row("t-5"), title: "Renamed" });

    const after = queryClient.getQueryData<Pages>(indexKey)!;
    expect(after.pages[0]).toBe(before.pages[0]);
    expect(after.pages[1]).toBe(before.pages[1]);
    expect(after.pages[2].tracks[0].title).toBe("Renamed");
  });

  it("leaves the whole list identical when the track is on no loaded page", () => {
    const { queryClient, before } = seed();

    syncTrackMetadataCaches(queryClient, entity("t-99"), { ...row("t-99"), title: "Renamed" });

    expect(queryClient.getQueryData<Pages>(indexKey)).toBe(before);
  });
});
