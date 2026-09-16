import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { AlbumId, PlaylistId, TrackId } from "@/types/ids";
import { ymAlbumId, ymArtistId, ymPlaylistId, ymTrackId } from "@/types/track-ref";
import albumFixture from "../__fixtures__/album-with-tracks.json";
import artistFixture from "../__fixtures__/artist-brief-info.json";
import artistAlbumsFixture from "../__fixtures__/artist-direct-albums.json";
import playlistFixture from "../__fixtures__/playlist.json";
import searchFixture from "../__fixtures__/search-all.json";
import searchPageFixture from "../__fixtures__/search-track-page1.json";
import tracksFixture from "../__fixtures__/tracks-batch.json";
import type { YmRequestPayload } from "../api/types";

const invokeCommand = vi.hoisted(() => vi.fn());

vi.mock("@/app/tauri-commands", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/tauri-commands")>();
  return { ...actual, invokeCommand };
});
vi.mock("@/lib/environment/userAgent", () => ({ IS_TAURI: true, IS_MOBILE: false, IS_WINDOWS: true }));
vi.mock(import("@tauri-apps/api/core"), async (importOriginal) => {
  const actual = await importOriginal();
  // The real Channel registers itself in __TAURI_INTERNALS__ — absent here.
  class MockChannel {
    onmessage: ((event: unknown) => void) | undefined;
  }
  return { ...actual, invoke: invokeCommand, Channel: MockChannel as unknown as typeof actual.Channel };
});

import { setMediaServerBaseForTests } from "@/lib/stream-url";
import { useSettingsStore } from "@/modules/settings/store";
import { useYmAuthStore } from "../store/ym-auth.store";
import { ymSourceProvider } from "../provider";

setMediaServerBaseForTests("http://127.0.0.1:4321/tok");

const SIGNED_IN = { loggedIn: true, uid: 42, hasPlus: true, displayName: "Tester" };
const NO_PLUS = { ...SIGNED_IN, hasPlus: false };

/** The envelope-free `result` Rust hands back, keyed by API path. */
const answers = new Map<string, unknown>();
const requests = (): YmRequestPayload[] =>
  invokeCommand.mock.calls.filter(([name]) => name === "ym_request").map(([, args]) => (args as { req: YmRequestPayload }).req);

// Liked-collection envelopes wrap recorded objects; the envelope shapes come
// from the API (`likes/albums?rich=true` → [{id, timestamp, album}],
// `likes/artists` → [{artist}], `likes/playlists` → [{playlist}]) and could
// not be recorded without an account.
// Two Cyrillic titles: an alphabetical order across scripts is a locale
// question, within one script it is not.
const likedAlbums = [
  { id: "10374", timestamp: "2026-09-01T10:00:00+00:00", album: artistFixture.result.albums[2] },
  { id: "43676684", timestamp: "2026-08-01T10:00:00+00:00", album: artistFixture.result.albums[0] },
];
const likedArtists = [{ artist: artistFixture.result.artist }, { artist: searchFixture.result.artists.results[1] }];
const likedPlaylists = [{ playlist: searchFixture.result.playlists.results[1] }];
const ownPlaylists = [playlistFixture.result];
const likesPlaylist = { ...playlistFixture.result, kind: 3, title: "Мне нравится", uid: 42, owner: { uid: 42 } };

describe("ymSourceProvider", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useYmAuthStore().applyStatus(SIGNED_IN);
    answers.clear();
    invokeCommand.mockReset();
    invokeCommand.mockImplementation(async (name: string, args?: unknown) => {
      if (name !== "ym_request") return undefined;
      const { req } = args as { req: YmRequestPayload };
      if (!answers.has(req.path)) throw new Error(`no answer for ${req.path}`);
      return answers.get(req.path);
    });
  });

  describe("availability", () => {
    it("is unavailable until someone signs in, and fails calls with UNAVAILABLE", async () => {
      useYmAuthStore().signedOut();

      expect(ymSourceProvider.isAvailable).toBe(false);
      const result = await ymSourceProvider.listArtists();
      expect(result._unsafeUnwrapErr().kind).toBe("UNAVAILABLE");
      expect(invokeCommand).not.toHaveBeenCalled();
    });

    it("is unavailable while the source is switched off in settings", () => {
      useSettingsStore().updateYmSource({ enabled: false });

      expect(ymSourceProvider.isAvailable).toBe(false);
    });

    it("is available when signed in, switched on and running in the app", () => {
      expect(ymSourceProvider.isAvailable).toBe(true);
    });

    it("offers downloads whatever the Plus flag says — a family member has none and still gets whole tracks", () => {
      expect(ymSourceProvider.capabilities.download).toBe(true);

      useYmAuthStore().applyStatus(NO_PLUS);
      expect(ymSourceProvider.capabilities.download).toBe(true);
    });
  });

  describe("checkConnection", () => {
    it("is fine when the status names the account and updates the Plus flag", async () => {
      answers.set("/account/status", { account: { uid: 42, login: "tester" }, plus: { hasPlus: false } });

      const result = await ymSourceProvider.checkConnection!();

      expect(result.isOk()).toBe(true);
      expect(useYmAuthStore().hasPlus).toBe(false);
    });

    it("is an AUTH failure when the status names no account (the anonymous shape)", async () => {
      answers.set("/account/status", { account: { now: "2026-09-15T18:58:33+03:00", region: 225 } });

      const result = await ymSourceProvider.checkConnection!();

      expect(result._unsafeUnwrapErr().kind).toBe("AUTH");
    });
  });

  describe("catalog", () => {
    it("lists liked artists from either envelope shape, dropping credited-only names", async () => {
      answers.set("/users/{uid}/likes/artists", [...likedArtists, { artist: { name: "nobody" } }]);

      const result = await ymSourceProvider.listArtists();

      expect(result._unsafeUnwrap().map(artist => artist.id)).toEqual(["ym:41075", expect.stringMatching(/^ym:\d+$/)]);
    });

    it("returns every liked album on the first page, sorted here, and nothing on later pages", async () => {
      answers.set("/users/{uid}/likes/albums", likedAlbums);

      const alpha = await ymSourceProvider.listAlbums({ offset: 0, limit: 100, sort: "alpha" });
      expect(alpha._unsafeUnwrap().map(album => album.title)).toEqual(["Дождь для нас", "Последний герой"]);
      expect(requests()[0]).toEqual({ path: "/users/{uid}/likes/albums", query: { rich: "true" } });

      const newest = await ymSourceProvider.listAlbums({ offset: 0, limit: 100, sort: "newest" });
      expect(newest._unsafeUnwrap().map(album => album.title)).toEqual(["Последний герой", "Дождь для нас"]);

      invokeCommand.mockClear();
      const later = await ymSourceProvider.listAlbums({ offset: 100, limit: 100, sort: "alpha" });
      expect(later._unsafeUnwrap()).toEqual([]);
      expect(invokeCommand).not.toHaveBeenCalled();
    });

    it("accepts liked albums and playlists bare, the way liked artists were recorded", async () => {
      answers.set("/users/{uid}/likes/albums", [artistFixture.result.albums[0], artistFixture.result.albums[1]]);
      answers.set("/users/{uid}/playlists/3", likesPlaylist);
      answers.set("/users/{uid}/playlists/list", []);
      answers.set("/users/{uid}/likes/playlists", [playlistFixture.result]);

      const albums = await ymSourceProvider.listAlbums({ offset: 0, limit: 100, sort: "alpha" });
      expect(albums._unsafeUnwrap().map(album => album.title)).toEqual(["Дождь для нас", "Легенда"]);

      const playlists = await ymSourceProvider.listPlaylists();
      expect(playlists._unsafeUnwrap().map(playlist => playlist.id)).toEqual(["ym:42:3", "ym:457553308:41075"]);
    });

    it("opens an album with its tracks flattened from the volumes", async () => {
      answers.set("/albums/3328/with-tracks", albumFixture.result);

      const result = await ymSourceProvider.getAlbum(ymAlbumId("3328"));

      const { album, tracks } = result._unsafeUnwrap();
      expect(album.id).toBe("ym:3328");
      expect(tracks).toHaveLength(4);
      expect(tracks[2]).toMatchObject({ id: "ym:40144", trackNo: 3, discNo: 1, availability: "full" });
    });

    it("opens an artist with the whole discography and the popular tracks", async () => {
      // brief-info lists 3 of the recorded 18 albums; direct-albums has them all.
      answers.set("/artists/41075/brief-info", artistFixture.result);
      const [a, b, c] = artistAlbumsFixture.result.albums;
      answers.set("/artists/41075/direct-albums", { pager: { page: 0, perPage: 200, total: 3 }, albums: [a, b, c] });

      const result = await ymSourceProvider.getArtist(ymArtistId("41075"));

      const { artist, albums, tracks } = result._unsafeUnwrap();
      expect(artist).toMatchObject({ id: "ym:41075", name: "КИНО", albumCount: 3 });
      expect(albums.map(album => album.id)).toEqual([`ym:${a.id}`, `ym:${b.id}`, `ym:${c.id}`]);
      expect(tracks).toHaveLength(3);
      expect(requests().find(r => r.path.endsWith("/direct-albums"))?.query).toEqual({ page: "0", "page-size": "200", "sort-by": "year" });
    });

    it("keeps paging the discography until the pager's total is reached", async () => {
      answers.set("/artists/41075/brief-info", artistFixture.result);
      const [a, b, c] = artistAlbumsFixture.result.albums;
      invokeCommand.mockImplementation(async (name: string, args?: unknown) => {
        if (name !== "ym_request") return undefined;
        const { req } = args as { req: YmRequestPayload };
        if (req.path.endsWith("/direct-albums")) {
          return req.query?.page === "0"
            ? { pager: { page: 0, perPage: 2, total: 3 }, albums: [a, b] }
            : { pager: { page: 1, perPage: 2, total: 3 }, albums: [c] };
        }
        return answers.get(req.path);
      });

      const result = await ymSourceProvider.getArtist(ymArtistId("41075"));

      expect(result._unsafeUnwrap().albums.map(album => album.id)).toEqual([`ym:${a.id}`, `ym:${b.id}`, `ym:${c.id}`]);
      expect(requests().filter(r => r.path.endsWith("/direct-albums")).map(r => r.query?.page)).toEqual(["0", "1"]);
    });

    it("lists the likes playlist, own playlists and liked playlists once each", async () => {
      answers.set("/users/{uid}/playlists/3", likesPlaylist);
      answers.set("/users/{uid}/playlists/list", ownPlaylists);
      answers.set("/users/{uid}/likes/playlists", [...likedPlaylists, { playlist: playlistFixture.result }]);

      const result = await ymSourceProvider.listPlaylists();

      const ids = result._unsafeUnwrap().map(playlist => playlist.id);
      expect(ids[0]).toBe("ym:42:3");
      expect(ids).toContain("ym:457553308:41075");
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("marks the account's playlists as owned, the liked ones as not", async () => {
      answers.set("/users/{uid}/playlists/3", likesPlaylist);
      answers.set("/users/{uid}/playlists/list", ownPlaylists);
      answers.set("/users/{uid}/likes/playlists", likedPlaylists);

      const list = (await ymSourceProvider.listPlaylists())._unsafeUnwrap();

      expect(list.find(playlist => playlist.id === "ym:42:3")?.isOwner).toBe(true);
      expect(list.find(playlist => playlist.id === "ym:457553308:41075")?.isOwner).toBe(false);

      answers.set("/users/457553308/playlists/41075", playlistFixture.result);
      const opened = (await ymSourceProvider.getPlaylist(ymPlaylistId(457553308, 41075)))._unsafeUnwrap();
      expect(opened.playlist.isOwner).toBe(false);
    });

    it("deletes an own playlist and refuses someone else's", async () => {
      answers.set("/users/{uid}/playlists/1000/delete", "ok");

      expect((await ymSourceProvider.deletePlaylist!(ymPlaylistId(42, 1000))).isOk()).toBe(true);
      expect(requests()).toEqual([{ method: "POST", path: "/users/{uid}/playlists/1000/delete" }]);

      const foreign = await ymSourceProvider.deletePlaylist!(ymPlaylistId(7, 1000));
      expect(foreign._unsafeUnwrapErr().kind).toBe("FORBIDDEN");
      expect(requests()).toHaveLength(1);
    });

    it("opens a playlist by owner and kind", async () => {
      answers.set("/users/457553308/playlists/41075", playlistFixture.result);

      const result = await ymSourceProvider.getPlaylist(ymPlaylistId(457553308, 41075));

      const { playlist, tracks } = result._unsafeUnwrap();
      expect(playlist).toMatchObject({ id: "ym:457553308:41075", name: "Лучшее: КИНО", trackCount: 20 });
      expect(tracks.map(track => track.id)).toEqual(["ym:38633712", "ym:38634578", "ym:38633756", "ym:38634573"]);
    });

    it("refuses a playlist id that is not owner:kind", async () => {
      expect((await ymSourceProvider.getPlaylist(ymPlaylistId("42", "3:extra")))._unsafeUnwrapErr().kind).toBe("PARSE");
      expect((await ymSourceProvider.getPlaylist(PlaylistId("nd:pl1")))._unsafeUnwrapErr().kind).toBe("PARSE");
      expect(invokeCommand).not.toHaveBeenCalled();
    });

    it("fetches one track through the batch endpoint and reports an unknown id as NOT_FOUND", async () => {
      answers.set("/tracks", tracksFixture.result.slice(0, 1));
      expect((await ymSourceProvider.getTrack(ymTrackId("40144")))._unsafeUnwrap().title).toBe("Read Your Mind");
      expect(requests()[0]).toEqual({ method: "POST", path: "/tracks", form: { "track-ids": "40144" } });

      answers.set("/tracks", []);
      expect((await ymSourceProvider.getTrack(ymTrackId("1")))._unsafeUnwrapErr().kind).toBe("NOT_FOUND");
    });

    it("rejects foreign ids before asking Rust", async () => {
      expect((await ymSourceProvider.getAlbum(AlbumId("yt:MPREb_1")))._unsafeUnwrapErr().kind).toBe("PARSE");
      expect((await ymSourceProvider.getTrack(TrackId("nd:s1")))._unsafeUnwrapErr().kind).toBe("PARSE");
      expect(invokeCommand).not.toHaveBeenCalled();
    });
  });

  describe("search", () => {
    it("answers the one-shot search from the mixed page and caps each group at the limit", async () => {
      answers.set("/search", searchFixture.result);

      const result = await ymSourceProvider.search("кино", ["track", "album", "artist"], { offset: 0, limit: 2 });

      const groups = result._unsafeUnwrap();
      expect(groups.tracks).toHaveLength(2);
      expect(groups.albums).toHaveLength(2);
      expect(groups.artists).toHaveLength(2);
      expect(requests()[0]).toEqual({ path: "/search", query: { text: "кино", type: "all", page: "0", nocorrect: "false" } });
    });

    it("pages by number: the cursor is the next page while any section has more", async () => {
      answers.set("/search", searchPageFixture.result);

      const first = await ymSourceProvider.searchPage!("кино", "track", null);
      expect(first._unsafeUnwrap().cursor).toBe("1");
      expect(requests()[0].query).toMatchObject({ type: "track", page: "0" });

      // The recorded answer is page 1 of the track tab.
      const second = await ymSourceProvider.searchPage!("кино", "track", "1");
      const page = second._unsafeUnwrap();
      expect(page.items).toHaveLength(3);
      expect(page.items.every(hit => hit.kind === "track")).toBe(true);
      expect(page.cursor).toBe("2");
      expect(requests()[1].query).toMatchObject({ type: "track", page: "1" });
    });

    it("stops before the page Yandex refuses", async () => {
      answers.set("/search", { ...searchPageFixture.result, tracks: { ...searchPageFixture.result.tracks, total: 1_000_000 } });

      const last = await ymSourceProvider.searchPage!("кино", "track", "99");

      expect(last._unsafeUnwrap().cursor).toBeNull();
      expect((await ymSourceProvider.searchPage!("кино", "track", "100"))._unsafeUnwrapErr().kind).toBe("PARSE");
    });

    it("an exhausted section ends the paging", async () => {
      answers.set("/search", { ...searchPageFixture.result, tracks: { ...searchPageFixture.result.tracks, total: 23 } });

      const page = await ymSourceProvider.searchPage!("кино", "track", "1");

      expect(page._unsafeUnwrap().cursor).toBeNull();
    });
  });

  describe("playback and files", () => {
    it("builds the media-server stream URL without touching the network", async () => {
      const result = await ymSourceProvider.resolveStreamUrl(ymTrackId("40144"));

      expect(result._unsafeUnwrap()).toBe("http://127.0.0.1:4321/tok/ym/track/40144");
      expect(invokeCommand).not.toHaveBeenCalled();
    });

    it("proxies covers through the image server with the size", () => {
      expect(ymSourceProvider.coverUrl("avatars.yandex.net/get-music-content/1/x.a.1-1/%%", 300))
        .toBe("http://127.0.0.1:4321/tok/ym/cover/avatars.yandex.net%2Fget-music-content%2F1%2Fx.a.1-1%2F%25%25?size=300");
    });

    it("warms the next track through ym_prefetch", async () => {
      await ymSourceProvider.prefetch!(ymTrackId("40144"));

      expect(invokeCommand).toHaveBeenCalledWith("ym_prefetch", { trackId: "40144" });
    });

    it("asks Rust to download even without the Plus flag; Rust refuses a preview, not an account", async () => {
      useYmAuthStore().applyStatus(NO_PLUS);
      invokeCommand.mockRejectedValue({ kind: "FORBIDDEN", message: "Yandex offers only a preview of this track" });

      const result = await ymSourceProvider.downloadToFile(ymTrackId("40144"));

      expect(invokeCommand).toHaveBeenCalledWith("ym_download", expect.objectContaining({ trackId: "40144" }));
      expect(result._unsafeUnwrapErr().kind).toBe("FORBIDDEN");
    });

    it("downloads through ym_download and reports the mp3 it produced", async () => {
      invokeCommand.mockResolvedValue({ path: "C:/tmp/40144.mp3", ext: "mp3" });

      const result = await ymSourceProvider.downloadToFile(ymTrackId("40144"));

      expect(result._unsafeUnwrap()).toEqual({ path: "C:/tmp/40144.mp3", format: { codec: "mp3" } });
      expect(invokeCommand).toHaveBeenCalledWith("ym_download", expect.objectContaining({ trackId: "40144" }));
    });

    it("maps a manager-initiated cancel onto CANCELLED", async () => {
      invokeCommand.mockRejectedValue({ kind: "CANCELLED", message: "cancelled" });

      const result = await ymSourceProvider.downloadToFile(ymTrackId("40144"));

      expect(result._unsafeUnwrapErr().kind).toBe("CANCELLED");
    });

    it("cancels through ym_download_cancel", async () => {
      await ymSourceProvider.cancelDownload!(ymTrackId("40144"));

      expect(invokeCommand).toHaveBeenCalledWith("ym_download_cancel", { trackId: "40144" });
    });
  });

  describe("likes", () => {
    it("answers the heart from the like list the store holds", () => {
      useYmAuthStore().setLikedTrackIds(["40144"]);

      expect(ymSourceProvider.isTrackLiked!(ymTrackId("40144"))).toBe(true);
      expect(ymSourceProvider.isTrackLiked!(ymTrackId("1"))).toBe(false);
      expect(ymSourceProvider.isTrackLiked!(TrackId("nd:40144"))).toBe(false);
    });

    it("a like goes to Yandex's list first and the store follows", async () => {
      answers.set("/users/{uid}/likes/tracks/add-multiple", "ok");
      answers.set("/users/{uid}/likes/tracks/remove", "ok");

      expect((await ymSourceProvider.setTrackLiked!(ymTrackId("40144"), true)).isOk()).toBe(true);
      expect(requests()[0]).toEqual({ method: "POST", path: "/users/{uid}/likes/tracks/add-multiple", form: { "track-ids": "40144" } });
      expect(useYmAuthStore().likedTrackIds.has("40144")).toBe(true);

      expect((await ymSourceProvider.setTrackLiked!(ymTrackId("40144"), false)).isOk()).toBe(true);
      expect(requests()[1]).toEqual({ method: "POST", path: "/users/{uid}/likes/tracks/remove", form: { "track-ids": "40144" } });
      expect(useYmAuthStore().likedTrackIds.has("40144")).toBe(false);
    });

    it("a refused like changes nothing in the store", async () => {
      useYmAuthStore().setLikedTrackIds([]);
      invokeCommand.mockRejectedValue({ kind: "NETWORK", message: "offline" });

      const result = await ymSourceProvider.setTrackLiked!(ymTrackId("40144"), true);

      expect(result._unsafeUnwrapErr().kind).toBe("NETWORK");
      expect(useYmAuthStore().likedTrackIds.has("40144")).toBe(false);
    });
  });

  describe("externalUrl", () => {
    it("links the track on its album page, or the bare track page without one", () => {
      expect(ymSourceProvider.externalUrl!({ id: ymTrackId("40144"), albumId: ymAlbumId("3328") }))
        .toBe("https://music.yandex.ru/album/3328/track/40144");
      expect(ymSourceProvider.externalUrl!({ id: ymTrackId("40144") })).toBe("https://music.yandex.ru/track/40144");
      expect(ymSourceProvider.externalUrl!({ id: TrackId("yt:x") })).toBeNull();
    });
  });
});

describe("entity likes", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useYmAuthStore().applyStatus(SIGNED_IN);
    answers.clear();
    invokeCommand.mockReset();
    invokeCommand.mockImplementation(async (name: string, args?: unknown) => {
      if (name !== "ym_request") return undefined;
      const { req } = args as { req: YmRequestPayload };
      if (!answers.has(req.path)) throw new Error(`no answer for ${req.path}`);
      return answers.get(req.path);
    });
  });

  it("likes and unlikes an artist, album and playlist at Yandex", async () => {
    answers.set("/users/{uid}/likes/artists/add-multiple", "ok");
    answers.set("/users/{uid}/likes/albums/remove", "ok");
    answers.set("/users/{uid}/likes/playlists/add-multiple", "ok");

    expect((await ymSourceProvider.setEntityLiked!("artist", ymArtistId("41075"), true)).isOk()).toBe(true);
    expect((await ymSourceProvider.setEntityLiked!("album", ymAlbumId("5307396"), false)).isOk()).toBe(true);
    expect((await ymSourceProvider.setEntityLiked!("playlist", ymPlaylistId(457553308, 1000), true)).isOk()).toBe(true);

    expect(requests()).toEqual([
      { method: "POST", path: "/users/{uid}/likes/artists/add-multiple", form: { "artist-ids": "41075" } },
      { method: "POST", path: "/users/{uid}/likes/albums/remove", form: { "album-ids": "5307396" } },
      { method: "POST", path: "/users/{uid}/likes/playlists/add-multiple", form: { "playlist-ids": "457553308:1000" } },
    ]);
  });

  it("refuses ids of other sources and fails with UNAVAILABLE when signed out", async () => {
    expect((await ymSourceProvider.setEntityLiked!("artist", "nd:artist9", true))._unsafeUnwrapErr().kind).toBe("PARSE");

    useYmAuthStore().signedOut();
    expect((await ymSourceProvider.setEntityLiked!("album", ymAlbumId("1"), true))._unsafeUnwrapErr().kind).toBe("UNAVAILABLE");
    expect(invokeCommand).not.toHaveBeenCalled();
  });

  it("passes a refused like through as the source's error", async () => {
    invokeCommand.mockRejectedValueOnce({ kind: "AUTH", message: "session expired" });

    const result = await ymSourceProvider.setEntityLiked!("artist", ymArtistId("41075"), true);

    expect(result._unsafeUnwrapErr()).toEqual({ kind: "AUTH", message: "session expired" });
  });
});
