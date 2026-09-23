import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackSource, TrackState } from "@/db/entities";
import { ArtistId } from "@/types/ids";
import { ndAlbumId, ndArtistId, ndTrackId, ytArtistId, ytTrackId } from "@/types/track-ref";
import type { SourceTrackDTO } from "@/modules/sources";

vi.mock("@/modules/search/service/searchIndex", () => ({
  indexImportedTracks: vi.fn(async () => {}),
  removeSearchDocuments: vi.fn(async () => {}),
}));
vi.mock("../shadowAlbumCover", () => ({ ensureShadowCover: vi.fn(async () => {}) }));
vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

import { db } from "@/db";
import { getArtists } from "@/queries/artist.queries";
import { ensurePinned } from "../ensurePinned";
import { promoteTrackToLibrary, removeTrackFromLibrary } from "../libraryMembership";

//
// Playing from browsing writes the track row only; album and artist rows
// exist only for library members ("Add to library" or a download).
//

const ytVideo: SourceTrackDTO = {
  id: ytTrackId("v1"),
  title: "Some Video",
  artistName: "Uploader X",
  duration: 200,
};

const ndSong: SourceTrackDTO = {
  id: ndTrackId("song1"),
  title: "Remote Song",
  artistName: "Artist A",
  albumTitle: "Remote Album",
  albumId: ndAlbumId("album1"),
  artistIds: [ndArtistId("a1")],
  duration: 240,
};

const localArtist = (id: string, name: string) =>
  db.artists.put({ id: ArtistId(id), name, pinned: 1, addedAt: 1, updatedAt: 1 });

describe("shadow pin writes no album/artist rows", () => {
  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
  });

  it("a YT video without artist ids leaves the artists table empty", async () => {
    await ensurePinned({ kind: "remote", dto: ytVideo }, { pinned: 0 });

    expect(await db.artists.count()).toBe(0);
    const row = await db.tracks.get(ytVideo.id);
    expect(row?.artistIds).toEqual([]);
    expect(row?.artistName).toBe("Uploader X");
  });

  it("an ND song keeps its source ids as links without album/artist rows", async () => {
    await ensurePinned({ kind: "remote", dto: ndSong }, { pinned: 0 });

    expect(await db.artists.count()).toBe(0);
    expect(await db.albums.count()).toBe(0);
    const row = await db.tracks.get(ndSong.id);
    expect(row?.artistIds).toEqual([ndArtistId("a1")]);
    expect(row?.albumId).toBe(ndAlbumId("album1"));
    expect(row?.albumTitle).toBe("Remote Album");
  });

  it("links a same-named local artist without writing a row", async () => {
    await localArtist("local-a", "Artist A");

    await ensurePinned({ kind: "remote", dto: ndSong }, { pinned: 0 });

    expect(await db.artists.count()).toBe(1);
    expect((await db.tracks.get(ndSong.id))?.artistIds).toEqual([ArtistId("local-a")]);
  });

  it("keeps the source's own ids when a credited name resolves to nothing", async () => {
    const collab: SourceTrackDTO = {
      ...ytVideo,
      id: ytTrackId("v2"),
      artistName: "A & B",
      artistIds: [ytArtistId("UCcollab")],
    };

    await ensurePinned({ kind: "remote", dto: collab }, { pinned: 0 });

    expect(await db.artists.count()).toBe(0);
    const row = await db.tracks.get(collab.id);
    expect(row?.artistIds).toEqual([ytArtistId("UCcollab")]);
    expect(row?.artistName).toBe("A & B");
  });

  it("maps the shadow track's display artist from the track itself", async () => {
    const track = await ensurePinned({ kind: "remote", dto: ndSong }, { pinned: 0 });

    expect(track.artist).toBe("Artist A");
    expect(track.albumName).toBe("Remote Album");
  });
});

describe("library membership creates and deletes the rows", () => {
  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
  });

  it("promoting a shadow row creates its album and artist rows", async () => {
    await ensurePinned({ kind: "remote", dto: ndSong }, { pinned: 0 });

    await promoteTrackToLibrary(ndSong.id);

    expect((await db.tracks.get(ndSong.id))?.pinned).toBe(1);
    expect(await db.albums.get(ndAlbumId("album1"))).toMatchObject({ title: "Remote Album", pinned: 1 });
    expect(await db.artists.get(ndArtistId("a1"))).toMatchObject({ name: "Artist A", pinned: 1 });
  });

  it("promoting a YT video without ids gives its uploader a library artist", async () => {
    await ensurePinned({ kind: "remote", dto: ytVideo }, { pinned: 0 });

    await promoteTrackToLibrary(ytVideo.id);

    const artists = await getArtists();
    expect(artists.map(artist => artist.name)).toEqual(["Uploader X"]);
    expect((await db.tracks.get(ytVideo.id))?.artistIds).toEqual([artists[0]?.id]);
  });

  it("removing the last library track deletes its album and artist rows", async () => {
    await ensurePinned({ kind: "remote", dto: ndSong });

    await removeTrackFromLibrary(ndSong.id);

    expect(await db.albums.count()).toBe(0);
    expect(await db.artists.count()).toBe(0);
    const row = await db.tracks.get(ndSong.id);
    expect(row?.pinned).toBe(0);
    expect(row?.artistIds).toEqual([ndArtistId("a1")]);
    expect(row?.albumId).toBe(ndAlbumId("album1"));
  });

  it("removing a YT video leaves no ghost artist and no dangling id", async () => {
    await ensurePinned({ kind: "remote", dto: ytVideo });
    expect(await getArtists()).toHaveLength(1);

    await removeTrackFromLibrary(ytVideo.id);

    expect(await getArtists()).toHaveLength(0);
    expect(await db.artists.count()).toBe(0);
    expect((await db.tracks.get(ytVideo.id))?.artistIds).toEqual([]);
  });

  it("keeps the rows while another library track still references them", async () => {
    await ensurePinned({ kind: "remote", dto: ndSong });
    await ensurePinned({ kind: "remote", dto: { ...ndSong, id: ndTrackId("song2"), title: "Second" } });

    await removeTrackFromLibrary(ndSong.id);

    expect((await db.albums.get(ndAlbumId("album1")))?.pinned).toBe(1);
    expect((await db.artists.get(ndArtistId("a1")))?.pinned).toBe(1);
  });

  it("keeps a local artist that still has its own tracks", async () => {
    await localArtist("local-a", "Artist A");
    await db.tracks.put({
      id: "local-track",
      title: "Local Song",
      artistName: "Artist A",
      albumTitle: "",
      artistIds: [ArtistId("local-a")],
      albumId: "",
      tagIds: [],
      source: TrackSource.LOCAL,
      state: TrackState.READY,
      pinned: 1,
      duration: 60,
      format: {},
      playCount: 0,
      addedAt: 1,
    } as never);
    await ensurePinned({ kind: "remote", dto: ndSong });

    await removeTrackFromLibrary(ndSong.id);

    expect(await db.artists.get(ArtistId("local-a"))).toBeDefined();
    expect((await db.tracks.get(ndSong.id))?.artistIds).toEqual([ArtistId("local-a")]);
  });
});
