import { describe, expect, it } from "vitest";
import albumFixture from "../__fixtures__/album-with-tracks.json";
import artistFixture from "../__fixtures__/artist-brief-info.json";
import derived from "../__fixtures__/derived-edge-cases.json";
import playlistFixture from "../__fixtures__/playlist.json";
import searchFixture from "../__fixtures__/search-all.json";
import tracksFixture from "../__fixtures__/tracks-batch.json";
import type { YmAlbum, YmArtist, YmArtistBriefInfo, YmPlaylist, YmSearchResult, YmTrack } from "../api/types";
import {
  flattenAlbumTracks,
  mapYmAlbum,
  mapYmArtist,
  mapYmArtistRef,
  mapYmPlaylist,
  mapYmTrack,
  playlistTracks,
  ymAvailability,
} from "../mappers";

// Every input below is a recorded Yandex response (see __fixtures__); the
// derived file names the one field it changed on a recorded object.

const album = albumFixture.result as YmAlbum;
const brief = artistFixture.result as YmArtistBriefInfo;
const playlist = playlistFixture.result as YmPlaylist;
const search = searchFixture.result as YmSearchResult;
const tracks = tracksFixture.result as YmTrack[];

describe("mapYmTrack", () => {
  it("brands the ids, joins the credits and keeps the album position", () => {
    const dto = mapYmTrack(tracks[0]);

    expect(dto.id).toBe("ym:40144");
    expect(dto.title).toBe("Read Your Mind");
    expect(dto.artistName).toBe("Avant");
    expect(dto.artists).toEqual([{ id: "ym:16313", name: "Avant" }]);
    expect(dto.artistIds).toEqual(["ym:16313"]);
    expect(dto.albumId).toBe("ym:3328");
    expect(dto.albumTitle).toBe("Private Room");
    expect(dto.duration).toBe(264);
    expect(dto.trackNo).toBe(3);
    expect(dto.discNo).toBe(1);
    expect(dto.coverRef).toBe("avatars.yandex.net/get-music-content/49876/0758f836.a.3328-1/%%");
    expect(dto.format).toEqual({ codec: "mp3" });
  });

  it("keeps the %% placeholder in the cover ref for the media server to size", () => {
    expect(mapYmTrack(tracks[1]).coverRef).toMatch(/\/%%$/);
  });

  it("an available track is full — the catalog cannot tell a preview account from a family member", () => {
    // Recorded: availableFullWithoutPermission is false on every catalog
    // track, and the signed-in family member (hasPlus=false) gets whole tracks.
    expect(mapYmTrack(tracks[0]).availability).toBe("full");
    expect(ymAvailability({ ...tracks[2], availableFullWithoutPermission: true })).toBe("full");
  });

  it("a locked track is unavailable", () => {
    const locked = derived.lockedTrack as YmTrack;

    expect(ymAvailability(locked)).toBe("unavailable");
    expect(mapYmTrack(locked).availability).toBe("unavailable");
  });

  it("appends the version to the title the way Yandex displays it", () => {
    const remaster: YmTrack = { ...tracks[0], version: "Remastered" };

    expect(mapYmTrack(remaster).title).toBe("Read Your Mind (Remastered)");
  });
});

describe("mapYmArtistRef", () => {
  it("a credited name without an id has no page", () => {
    expect(mapYmArtistRef(derived.idlessArtist as YmArtist)).toEqual({ name: "Неизвестный исполнитель" });
    expect(mapYmArtist(derived.idlessArtist as YmArtist)).toBeNull();
  });

  it("treats Yandex's placeholder id 0 as no id", () => {
    expect(mapYmArtistRef({ id: 0, name: "Various" })).toEqual({ name: "Various" });
  });
});

describe("mapYmAlbum", () => {
  it("maps the recorded album with its cover, year and count", () => {
    expect(mapYmAlbum(album)).toEqual({
      id: "ym:3328",
      title: "Private Room",
      artistId: "ym:16313",
      artistName: "Avant",
      year: 2007,
      coverRef: "avatars.yandex.net/get-music-content/49876/0758f836.a.3328-1/%%",
      trackCount: 16,
    });
  });

  it("an album without art has no cover ref rather than an empty one", () => {
    expect(mapYmAlbum(derived.coverlessAlbum as YmAlbum).coverRef).toBeUndefined();
  });
});

describe("flattenAlbumTracks", () => {
  it("numbers discs and tracks by their place and hands the album down to every row", () => {
    const rows = flattenAlbumTracks(album);

    expect(rows).toHaveLength(4);
    expect(rows.map(row => [row.discNo, row.trackNo])).toEqual([[1, 1], [1, 2], [1, 3], [1, 4]]);
    expect(rows[0]).toMatchObject({
      id: "ym:40142",
      title: "Private Room Intro",
      albumId: "ym:3328",
      albumTitle: "Private Room",
      coverRef: "avatars.yandex.net/get-music-content/49876/0758f836.a.3328-1/%%",
      availability: "full",
    });
  });

  it("a second disc continues the numbering from one", () => {
    const twoDiscs: YmAlbum = { ...album, volumes: [album.volumes![0].slice(0, 2), album.volumes![0].slice(2, 4)] };

    const rows = flattenAlbumTracks(twoDiscs);

    expect(rows.map(row => [row.discNo, row.trackNo])).toEqual([[1, 1], [1, 2], [2, 1], [2, 2]]);
  });

  it("an album that came without volumes has no rows", () => {
    expect(flattenAlbumTracks({ ...album, volumes: undefined })).toEqual([]);
  });
});

describe("mapYmArtist", () => {
  it("maps the recorded brief-info artist with its direct album count", () => {
    expect(mapYmArtist(brief.artist)).toEqual({
      id: "ym:41075",
      name: "КИНО",
      albumCount: 18,
      coverRef: "avatars.yandex.net/get-music-content/33216/c6d507c7.p.41075/%%",
    });
  });
});

describe("mapYmPlaylist", () => {
  it("addresses the playlist by owner and kind and keeps the versioned cover uri", () => {
    expect(mapYmPlaylist(playlist)).toEqual({
      id: "ym:457553308:41075",
      name: "Лучшее: КИНО",
      trackCount: 20,
      coverRef: "avatars.yandex.net/get-music-user-playlist/10311229/s9xdf1jvxpHCJj/%%?1709726510822",
    });
  });

  it("takes the owner from `owner.uid` when the top-level uid is missing", () => {
    const { uid: _uid, ...withoutUid } = playlist;

    expect(mapYmPlaylist(withoutUid).id).toBe("ym:457553308:41075");
  });

  it("an empty playlist keeps its zero count", () => {
    const dto = mapYmPlaylist(derived.emptyPlaylist as YmPlaylist);

    expect(dto.trackCount).toBe(0);
    expect(playlistTracks(derived.emptyPlaylist as YmPlaylist)).toEqual([]);
  });

  it("a mosaic cover uses its first tile", () => {
    const mosaic: YmPlaylist = { ...playlist, cover: { type: "mosaic", itemsUri: ["a/%%", "b/%%"] } };

    expect(mapYmPlaylist(mosaic).coverRef).toBe("a/%%");
  });
});

describe("playlistTracks", () => {
  it("maps the recorded entries and skips ones without a track body", () => {
    const rows = playlistTracks(playlist);

    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ id: "ym:38633712", title: "Группа крови", availability: "full" });

    const withStub: YmPlaylist = { ...playlist, tracks: [{ id: 1 }, ...playlist.tracks!] };
    expect(playlistTracks(withStub)).toHaveLength(4);
  });
});

describe("search results", () => {
  it("every recorded section maps without inventing ids", () => {
    expect(search.tracks!.results.map(track => mapYmTrack(track).id)).toEqual(["ym:64072310", expect.stringMatching(/^ym:\d+$/), expect.stringMatching(/^ym:\d+$/)]);
    expect(search.albums!.results.map(mapYmAlbum).every(dto => dto.id.startsWith("ym:"))).toBe(true);
    expect(search.artists!.results.map(mapYmArtist).filter(Boolean)).toHaveLength(2);
    expect(search.playlists!.results.map(mapYmPlaylist)[0].id).toMatch(/^ym:\d+:\d+$/);
  });
});
