import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackId } from "@/types/ids";
import { fakeTrackRepository, type FakeTrackScopes } from "@/test/fakeTrackScope";

const repositories = vi.hoisted(() => ({
  trackRepository: {
    findByIds: vi.fn(),
    likeMany: vi.fn(),
    unlikeMany: vi.fn(),
  },
  albumRepository: { findByIds: vi.fn(async () => []) },
  artistRepository: { findByIds: vi.fn(async () => []) },
  coverRepository: {},
  playlistRepository: {},
}));

const search = vi.hoisted(() => ({
  searchDocuments: vi.fn(),
  searchTracks: vi.fn(),
}));

vi.mock("@/db/repositories", () => repositories);
vi.mock("@/services/search/searchIndex", () => ({
  searchDocuments: search.searchDocuments,
  searchTracks: search.searchTracks,
  syncSearchIndex: vi.fn(async () => {}),
}));

import {
  getAllTrackIds,
  getAllTracksForQueue,
  getTracksByIdsSorted,
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

const useTrackScopes = (scopes: FakeTrackScopes) =>
  Object.assign(repositories.trackRepository, fakeTrackRepository(scopes));

const titled = (ids: readonly TrackId[]) => ids.map(id => entity(id, id.toUpperCase()));

describe("bulk track queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTrackScopes({});
  });

  it("getAllTrackIds without a search goes through the id-only sorted query", async () => {
    const tracks = useTrackScopes({ members: [entity("b", "B"), entity("a", "A")] });

    const ids = await getAllTrackIds("title_asc", "   ");

    expect(ids).toEqual(["a", "b"]);
    expect(tracks.members().ids).toHaveBeenCalledWith("title_asc");
    expect(tracks.members().rows).not.toHaveBeenCalled();
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
    expect(repositories.trackRepository.members).not.toHaveBeenCalled();
  });

  it("getAllTrackIds without a sort falls back to the newest-first index order", async () => {
    const tracks = useTrackScopes({ members: [] });

    await getAllTrackIds(null, "");

    expect(tracks.members().ids).toHaveBeenCalledWith("date_added_desc");
  });

  // Searching without a chosen sort lists hits by relevance; a chosen sort
  // reorders the same hits. The list page and the queue built from it must
  // agree, so both go through the same rule.
  describe("search + sort", () => {
    const hits = { results: [{ entityId: "b" }, { entityId: "a" }, { entityId: "c" }], total: 3, totalDuration: 0 };

    it("getAllTracksForQueue with a search and no sort keeps relevance order", async () => {
      search.searchTracks.mockResolvedValue({ tracks: [{ id: "b" }, { id: "a" }], total: 2, totalDuration: 0 });

      const tracks = await getAllTracksForQueue(null, "que");

      expect(tracks.map(t => t.id)).toEqual(["b", "a"]);
      expect(search.searchTracks).toHaveBeenCalledWith("que", 0, undefined);
      expect(repositories.trackRepository.withIds).not.toHaveBeenCalled();
    });

    it("getAllTracksForQueue with a search and a sort sorts the hits", async () => {
      search.searchDocuments.mockResolvedValue(hits);
      const scopes = useTrackScopes({ withIds: titled });

      const tracks = await getAllTracksForQueue("title_asc", "que");

      expect(tracks.map(t => t.id)).toEqual(["a", "b", "c"]);
      expect(scopes.withIds).toHaveBeenCalledWith(["b", "a", "c"]);
      expect(scopes.withIds([TrackId("b"), TrackId("a"), TrackId("c")]).rows).toHaveBeenCalledWith({ sort: "title_asc" });
    });

    it("getTracksByIdsSorted without a sort keeps the given id order", async () => {
      repositories.trackRepository.findByIds.mockResolvedValue([entity("a", "A"), entity("b", "B")]);

      const tracks = await getTracksByIdsSorted([TrackId("b"), TrackId("a")], null);

      expect(tracks.map(t => t.id)).toEqual(["b", "a"]);
      expect(repositories.trackRepository.withIds).not.toHaveBeenCalled();
    });
  });

  it("setTracksLikedAndSync(true) likes in one repository call", async () => {
    repositories.trackRepository.likeMany.mockResolvedValue(2);

    const changed = await setTracksLikedAndSync([TrackId("a"), TrackId("b")], true);

    expect(changed).toBe(2);
    expect(repositories.trackRepository.likeMany).toHaveBeenCalledTimes(1);
    expect(repositories.trackRepository.likeMany.mock.calls[0][0]).toEqual(["a", "b"]);
    expect(repositories.trackRepository.unlikeMany).not.toHaveBeenCalled();
  });

  it("setTracksLikedAndSync(false) unlikes", async () => {
    repositories.trackRepository.unlikeMany.mockResolvedValue(1);

    const changed = await setTracksLikedAndSync([TrackId("a")], false);

    expect(changed).toBe(1);
    expect(repositories.trackRepository.unlikeMany).toHaveBeenCalledWith(["a"]);
    expect(repositories.trackRepository.likeMany).not.toHaveBeenCalled();
  });

  it("setTracksLikedAndSync with no ids does nothing", async () => {
    expect(await setTracksLikedAndSync([], true)).toBe(0);

    expect(repositories.trackRepository.likeMany).not.toHaveBeenCalled();
  });
});
