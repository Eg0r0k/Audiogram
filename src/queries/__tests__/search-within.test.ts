import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "neverthrow";
import type { TrackEntity } from "@/db/entities";
import { TrackSource, TrackState } from "@/db/entities";
import { TrackId } from "@/types/ids";

const repositories = vi.hoisted(() => ({
  trackRepository: {
    findByIds: vi.fn(),
    findSortedByIds: vi.fn(),
  },
  artistRepository: { findByIds: vi.fn(async () => ok([])) },
  albumRepository: { findByIds: vi.fn(async () => ok([])) },
  coverRepository: {},
}));

const search = vi.hoisted(() => ({ searchDocuments: vi.fn() }));

vi.mock("@/db/repositories", () => repositories);
vi.mock("@/modules/search/service/searchIndex", () => search);
vi.mock("@/modules/search/service/buildDocuments", () => ({}));

import { searchTracksWithin } from "../track.queries";

const entity = (id: string): TrackEntity => ({
  id: TrackId(id),
  title: id,
  artistIds: [],
  albumId: "" as never,
  tagIds: [],
  duration: 1,
  source: TrackSource.LOCAL_INTERNAL,
  storagePath: id,
  state: TrackState.READY,
  format: {},
  playCount: 0,
  addedAt: 0,
});

const hits = (...ids: string[]) => ({
  results: ids.map(id => ({ id: `track:${id}`, type: "track", title: id, entityId: id })),
  total: ids.length,
  totalDuration: 0,
});

describe("searchTracksWithin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repositories.trackRepository.findByIds.mockImplementation(async (ids: string[]) => ok(ids.map(entity)));
    repositories.trackRepository.findSortedByIds.mockImplementation(async (ids: string[]) =>
      ok([...ids].sort().map(entity)),
    );
  });

  it("scopes the index search to the ids and pages the hits in relevance order", async () => {
    search.searchDocuments.mockResolvedValue(hits("t3", "t1", "t2"));

    const page = await searchTracksWithin([TrackId("t1"), TrackId("t2"), TrackId("t3")], "q", 0, 2);

    expect(search.searchDocuments).toHaveBeenCalledWith("q", "track", {
      offset: 0,
      within: new Set(["t1", "t2", "t3"]),
    });
    expect(page.tracks.map(track => track.id)).toEqual(["t3", "t1"]);
    expect(page).toMatchObject({ total: 3, nextOffset: 2 });
  });

  it("re-sorts every hit before paging when a sort is chosen", async () => {
    search.searchDocuments.mockResolvedValue(hits("t3", "t1", "t2"));

    const page = await searchTracksWithin([TrackId("t1"), TrackId("t2"), TrackId("t3")], "q", 1, 2, "title_asc");

    expect(repositories.trackRepository.findSortedByIds).toHaveBeenCalledWith(["t3", "t1", "t2"], "title_asc");
    expect(page.tracks.map(track => track.id)).toEqual(["t2", "t3"]);
    expect(page).toMatchObject({ total: 3, nextOffset: null });
  });

  it("returns every hit for an infinite limit", async () => {
    search.searchDocuments.mockResolvedValue(hits("t2", "t1"));

    const page = await searchTracksWithin([TrackId("t1"), TrackId("t2")], "q", 0, Infinity);

    expect(page.tracks).toHaveLength(2);
    expect(page.nextOffset).toBeNull();
  });

  it("does not search at all for an empty collection", async () => {
    const page = await searchTracksWithin([], "q", 0);

    expect(search.searchDocuments).not.toHaveBeenCalled();
    expect(page).toEqual({ tracks: [], nextOffset: null, total: 0 });
  });
});
