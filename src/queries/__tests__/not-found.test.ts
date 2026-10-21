import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/vue-query";
import { DbError } from "@/db/errors/db.errors";
import { isNotFound, toAppError } from "@/lib/errors";
import { AlbumId, ArtistId, PlaylistId, TrackId } from "@/types/ids";

vi.mock("@/db/storage", () => ({ storageService: { deleteFile: vi.fn() } }));
vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock("@/modules/search/service/searchIndex", () => ({
  removeSearchDocuments: vi.fn(async () => {}),
  upsertSearchDocuments: vi.fn(async () => {}),
}));
vi.mock("@/modules/search/service/buildDocuments", () => ({
  buildAlbumDocFromDb: vi.fn(async () => ({})),
  buildTrackDocFromDb: vi.fn(async () => ({})),
}));

import { db } from "@/db";
import { playlistRepository } from "@/db/repositories";
import { unwrapResult } from "@/lib/errors/unwrap";
import type { Track } from "@/modules/player/types";
import { getAlbumByIdOrThrow, getAlbumPageData } from "../album.queries";
import { getArtistByIdOrThrow } from "../artist.queries";
import { getPlaylistByIdOrThrow } from "../playlist.queries";
import {
  addTracksToAlbumAndSync,
  addTracksToArtistAndSync,
  attachTrackLyricsAndSync,
  deleteTrackAndSync,
  toggleTrackLikeAndSync,
  updateTrackMetadataAndSync,
} from "../track.queries";

const missingTrack = { id: TrackId("t-missing"), isLiked: false } as unknown as Track;
const orphanAlbumId = AlbumId("al-orphan");

const rejectionOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => {
      throw new Error("expected a rejection");
    },
    (error: unknown) => error,
  );

describe("not-found lookups (integration)", () => {
  let queryClient: QueryClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    queryClient = new QueryClient();
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    await db.albums.put({ id: orphanAlbumId, title: "Orphan", artistId: ArtistId("ar-gone"), addedAt: 1, updatedAt: 1 });
  });

  it("album, artist, playlist and track lookups throw DbError NOT_FOUND", async () => {
    const lookups: [string, () => Promise<unknown>][] = [
      ["Album not found", () => getAlbumByIdOrThrow(AlbumId("al-missing"))],
      ["Artist not found", () => getAlbumPageData(orphanAlbumId)],
      ["Artist not found", () => getArtistByIdOrThrow(ArtistId("ar-missing"))],
      ["Playlist not found", () => getPlaylistByIdOrThrow(PlaylistId("pl-missing"))],
      ["Track not found", () => toggleTrackLikeAndSync(queryClient, missingTrack)],
      ["Track not found", () => attachTrackLyricsAndSync(queryClient, missingTrack, "lyrics/t.lrc")],
      ["Track not found", () => updateTrackMetadataAndSync(queryClient, missingTrack, { title: "T", artistNames: [] })],
      ["Track not found", () => deleteTrackAndSync(queryClient, missingTrack)],
      ["Playlist not found", () => unwrapResult(playlistRepository.findTrackIdsPaginated(PlaylistId("pl-missing"), 0, 10))],
    ];

    for (const [message, lookup] of lookups) {
      const error = await rejectionOf(lookup());

      expect(error, message).toBeInstanceOf(DbError);
      expect((error as DbError).code).toBe("NOT_FOUND");
      expect((error as DbError).message).toBe(message);
    }
  });

  it("adding a missing track to an album or an artist throws DbError NOT_FOUND", async () => {
    const artistId = ArtistId("ar-present");
    await db.artists.put({ id: artistId, name: "Present", pinned: 1, addedAt: 1, updatedAt: 1 });

    const additions = [
      () => addTracksToAlbumAndSync(queryClient, orphanAlbumId, [missingTrack]),
      () => addTracksToArtistAndSync(queryClient, artistId, [missingTrack]),
    ];

    for (const add of additions) {
      const error = await rejectionOf(add());

      expect(error).toBeInstanceOf(DbError);
      expect((error as DbError).code).toBe("NOT_FOUND");
      expect((error as DbError).message).toBe("Track not found: t-missing");
    }
  });

  it("the thrown error normalises to isNotFound", async () => {
    const album = await rejectionOf(getAlbumByIdOrThrow(AlbumId("al-missing")));
    const track = await rejectionOf(deleteTrackAndSync(queryClient, missingTrack));
    const playlistPage = await playlistRepository.findTrackIdsPaginated(PlaylistId("pl-missing"), 0, 10);

    expect(isNotFound(toAppError(album))).toBe(true);
    expect(isNotFound(toAppError(track))).toBe(true);
    expect(playlistPage.isErr() && isNotFound(toAppError(playlistPage.error))).toBe(true);
  });
});
