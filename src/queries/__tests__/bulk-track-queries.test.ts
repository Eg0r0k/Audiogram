import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "neverthrow";
import { QueryClient } from "@tanstack/vue-query";
import { TrackId } from "@/types/ids";

const repositories = vi.hoisted(() => ({
  trackRepository: {
    findAllIdsSorted: vi.fn(),
    findSortedByIds: vi.fn(),
    findByIds: vi.fn(),
    likeMany: vi.fn(),
    unlikeMany: vi.fn(),
  },
  albumRepository: { findByIds: vi.fn(async () => ok([])) },
  artistRepository: { findByIds: vi.fn(async () => ok([])) },
  coverRepository: {},
  playlistRepository: {},
}));

const search = vi.hoisted(() => ({
  searchDocuments: vi.fn(),
  searchTracks: vi.fn(),
}));

vi.mock("@/db/repositories", () => repositories);
vi.mock("@/modules/search/service/searchIndex", () => ({
  searchDocuments: search.searchDocuments,
  searchTracks: search.searchTracks,
  removeSearchDocuments: vi.fn(async () => {}),
  upsertSearchDocuments: vi.fn(async () => {}),
}));
vi.mock("@/modules/search/service/buildDocuments", () => ({
  buildArtistDoc: vi.fn(),
  buildAlbumDocFromDb: vi.fn(),
  buildTrackDocFromDb: vi.fn(),
}));

import * as cache from "../cache";
import {
  getAllTrackIds,
  getAllTracksForQueue,
  getTracksByIdsSorted,
  getTracksPaginated,
  setTracksLikedAndSync,
} from "../track.queries";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";

const entity = (id: string, title: string): TrackEntity => ({
  id: TrackId(id),
  title,
  artistName: "",
  albumTitle: "",
  artistIds: [],
  albumId: "al" as TrackEntity["albumId"],
  tagIds: [],
  source: TrackSource.LOCAL_INTERNAL,
  pinned: 1,
  state: TrackState.READY,
  duration: 1,
  format: {},
  playCount: 0,
  addedAt: 0,
});

describe("bulk track queries", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient();
  });

  it("getAllTrackIds without a search goes through the id-only sorted query", async () => {
    repositories.trackRepository.findAllIdsSorted.mockResolvedValue(ok([TrackId("b"), TrackId("a")]));

    const ids = await getAllTrackIds("title_asc", "   ");

    expect(ids).toEqual(["b", "a"]);
    expect(repositories.trackRepository.findAllIdsSorted).toHaveBeenCalledWith("title_asc");
    expect(search.searchDocuments).not.toHaveBeenCalled();
  });

  it("getAllTrackIds with a search takes every matching document id from the index", async () => {
    search.searchDocuments.mockResolvedValue({
      results: [{ entityId: "x" }, { entityId: "y" }],
      total: 2,
      totalDuration: 0,
    });

    const ids = await getAllTrackIds("title_asc", "que");

    expect(ids).toEqual(["x", "y"]);
    expect(search.searchDocuments).toHaveBeenCalledWith("que", "track", { offset: 0 });
    expect(repositories.trackRepository.findAllIdsSorted).not.toHaveBeenCalled();
  });

  it("getAllTrackIds without a sort falls back to the newest-first index order", async () => {
    repositories.trackRepository.findAllIdsSorted.mockResolvedValue(ok([]));

    await getAllTrackIds(null, "");

    expect(repositories.trackRepository.findAllIdsSorted).toHaveBeenCalledWith("date_added_desc");
  });

  // Searching without a chosen sort lists hits by relevance; a chosen sort
  // reorders the same hits. The list page and the queue built from it must
  // agree, so both go through the same rule.
  describe("search + sort", () => {
    const hits = { results: [{ entityId: "b" }, { entityId: "a" }, { entityId: "c" }], total: 3, totalDuration: 0 };

    it("getTracksPaginated with a search and no sort keeps relevance order", async () => {
      search.searchTracks.mockResolvedValue({ tracks: [{ id: "b" }, { id: "a" }], total: 2, totalDuration: 0 });

      const page = await getTracksPaginated(0, "que", 50, null);

      expect(page.tracks.map(t => t.id)).toEqual(["b", "a"]);
      expect(search.searchTracks).toHaveBeenCalledWith("que", 0, 50);
      expect(repositories.trackRepository.findSortedByIds).not.toHaveBeenCalled();
    });

    it("getTracksPaginated with a search and a sort pages the sorted hits", async () => {
      search.searchDocuments.mockResolvedValue(hits);
      repositories.trackRepository.findSortedByIds.mockResolvedValue(ok([entity("a", "A"), entity("b", "B"), entity("c", "C")]));

      const page = await getTracksPaginated(2, "que", 2, "title_asc");

      expect(search.searchDocuments).toHaveBeenCalledWith("que", "track", { offset: 0 });
      expect(repositories.trackRepository.findSortedByIds).toHaveBeenCalledWith(["b", "a", "c"], "title_asc");
      expect(page.tracks.map(t => t.id)).toEqual(["c"]);
      expect(page.total).toBe(3);
      expect(page.nextOffset).toBeNull();
      expect(search.searchTracks).not.toHaveBeenCalled();
    });

    it("getAllTracksForQueue with a search and no sort keeps relevance order", async () => {
      search.searchTracks.mockResolvedValue({ tracks: [{ id: "b" }, { id: "a" }], total: 2, totalDuration: 0 });

      const tracks = await getAllTracksForQueue(null, "que");

      expect(tracks.map(t => t.id)).toEqual(["b", "a"]);
      expect(search.searchTracks).toHaveBeenCalledWith("que", 0, undefined);
      expect(repositories.trackRepository.findSortedByIds).not.toHaveBeenCalled();
    });

    it("getAllTracksForQueue with a search and a sort sorts the hits", async () => {
      search.searchDocuments.mockResolvedValue(hits);
      repositories.trackRepository.findSortedByIds.mockResolvedValue(ok([entity("a", "A"), entity("b", "B"), entity("c", "C")]));

      const tracks = await getAllTracksForQueue("title_asc", "que");

      expect(tracks.map(t => t.id)).toEqual(["a", "b", "c"]);
      expect(repositories.trackRepository.findSortedByIds).toHaveBeenCalledWith(["b", "a", "c"], "title_asc");
    });

    it("getTracksByIdsSorted without a sort keeps the given id order", async () => {
      repositories.trackRepository.findByIds.mockResolvedValue(ok([entity("a", "A"), entity("b", "B")]));

      const tracks = await getTracksByIdsSorted([TrackId("b"), TrackId("a")], null);

      expect(tracks.map(t => t.id)).toEqual(["b", "a"]);
      expect(repositories.trackRepository.findSortedByIds).not.toHaveBeenCalled();
    });
  });

  it("setTracksLikedAndSync(true) likes in one repository call and invalidates once", async () => {
    repositories.trackRepository.likeMany.mockResolvedValue(ok(2));
    const invalidate = vi.spyOn(cache, "invalidateForTrackMutation");

    const changed = await setTracksLikedAndSync(queryClient, [TrackId("a"), TrackId("b")], true);

    expect(changed).toBe(2);
    expect(repositories.trackRepository.likeMany).toHaveBeenCalledTimes(1);
    expect(repositories.trackRepository.likeMany.mock.calls[0][0]).toEqual(["a", "b"]);
    expect(repositories.trackRepository.unlikeMany).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith(queryClient, { kind: "relations" });
  });

  it("setTracksLikedAndSync(false) unlikes", async () => {
    repositories.trackRepository.unlikeMany.mockResolvedValue(ok(1));

    const changed = await setTracksLikedAndSync(queryClient, [TrackId("a")], false);

    expect(changed).toBe(1);
    expect(repositories.trackRepository.unlikeMany).toHaveBeenCalledWith(["a"]);
    expect(repositories.trackRepository.likeMany).not.toHaveBeenCalled();
  });

  it("setTracksLikedAndSync with no ids does nothing", async () => {
    const invalidate = vi.spyOn(cache, "invalidateForTrackMutation");

    expect(await setTracksLikedAndSync(queryClient, [], true)).toBe(0);

    expect(repositories.trackRepository.likeMany).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
});
