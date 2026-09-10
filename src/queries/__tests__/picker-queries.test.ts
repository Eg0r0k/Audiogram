import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "neverthrow";

const repositories = vi.hoisted(() => ({
  artistRepository: { findPinned: vi.fn(), search: vi.fn() },
  albumRepository: { findAllSortedByTitle: vi.fn(), search: vi.fn() },
  trackRepository: {},
  coverRepository: {},
  offlineCopyRepository: {},
  playlistRepository: {},
}));

vi.mock("@/db/repositories", () => repositories);
vi.mock("@/modules/search/service/searchIndex", () => ({
  searchDocuments: vi.fn(),
  searchTracks: vi.fn(),
  removeSearchDocuments: vi.fn(async () => {}),
  upsertSearchDocuments: vi.fn(async () => {}),
}));
vi.mock("@/modules/search/service/buildDocuments", () => ({
  buildArtistDoc: vi.fn(),
  buildAlbumDocFromDb: vi.fn(),
  buildTrackDocFromDb: vi.fn(),
}));

import { searchArtists } from "../artist.queries";
import { searchAlbums } from "../album.queries";

const rows = (count: number, pinned = 1) =>
  Array.from({ length: count }, (_, i) => ({ id: `e${i}`, name: `N${i}`, title: `T${i}`, pinned }));

// The pickers list the whole library when nothing is typed: a cap would
// silently hide part of it (and the row the picker should open on).
describe("picker queries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("searchArtists without a query returns every pinned artist regardless of the limit", async () => {
    repositories.artistRepository.findPinned.mockResolvedValue(ok(rows(1200)));

    const artists = await searchArtists("   ", 1000);

    expect(artists).toHaveLength(1200);
    expect(repositories.artistRepository.search).not.toHaveBeenCalled();
  });

  it("searchArtists with a query keeps the limit on the repository search", async () => {
    repositories.artistRepository.search.mockResolvedValue(ok([...rows(2), ...rows(1, 0)]));

    const artists = await searchArtists("n", 1000);

    expect(repositories.artistRepository.search).toHaveBeenCalledWith("n", 1000);
    expect(artists).toHaveLength(2);
  });

  it("searchAlbums without a query returns every pinned album in title order", async () => {
    repositories.albumRepository.findAllSortedByTitle.mockResolvedValue(ok([...rows(1200), ...rows(3, 0)]));

    const albums = await searchAlbums("", 1000);

    expect(albums).toHaveLength(1200);
    expect(repositories.albumRepository.search).not.toHaveBeenCalled();
  });
});
