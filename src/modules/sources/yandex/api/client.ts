import { ResultAsync } from "neverthrow";
import { COMMANDS, invokeCommand } from "@/app/tauri-commands";
import { asSourceError } from "@/modules/sources/lib/errors";
import type { SourceError } from "@/types/source-dto";
import type {
  YmAccountStatus,
  YmAlbum,
  YmArtist,
  YmArtistAlbumsPage,
  YmArtistBriefInfo,
  YmLikedAlbum,
  YmLikedArtist,
  YmLikedPlaylist,
  YmLikedTracks,
  YmPlaylist,
  YmRequestPayload,
  YmSearchResult,
  YmSearchType,
  YmStationTracks,
  YmTrack,
} from "./types";

//
// Typed calls over `ym_request`. Every path is one the Rust allowlist knows;
// `{uid}` is left for Rust to fill in — the frontend never handles the uid.
//

export const mapYmError = asSourceError;

export const ymRequest = <T>(req: YmRequestPayload): ResultAsync<T, SourceError> =>
  ResultAsync.fromPromise(
    invokeCommand(COMMANDS.ymRequest, { req }) as Promise<T>,
    asSourceError,
  );

export const ymApi = {
  accountStatus: () => ymRequest<YmAccountStatus>({ path: "/account/status" }),

  // Likes come wrapped ({album, timestamp}) or bare; the provider accepts both.
  likedAlbums: () =>
    ymRequest<(YmLikedAlbum | YmAlbum)[]>({ path: "/users/{uid}/likes/albums", query: { rich: "true" } }),

  likedArtists: () => ymRequest<(YmLikedArtist | YmArtist)[]>({ path: "/users/{uid}/likes/artists" }),

  likedPlaylists: () => ymRequest<(YmLikedPlaylist | YmPlaylist)[]>({ path: "/users/{uid}/likes/playlists" }),

  likedTrackIds: () =>
    ymRequest<YmLikedTracks>({ path: "/users/{uid}/likes/tracks" })
      .map(result => (result.library?.tracks ?? []).map(track => String(track.id))),

  likeTracks: (trackIds: readonly string[]) =>
    ymRequest<unknown>({ method: "POST", path: "/users/{uid}/likes/tracks/add-multiple", form: { "track-ids": trackIds.join(",") } }),

  unlikeTracks: (trackIds: readonly string[]) =>
    ymRequest<unknown>({ method: "POST", path: "/users/{uid}/likes/tracks/remove", form: { "track-ids": trackIds.join(",") } }),

  // Entity likes mirror the track ones: one form field of comma-joined ids.
  likeArtists: (artistIds: readonly string[]) =>
    ymRequest<unknown>({ method: "POST", path: "/users/{uid}/likes/artists/add-multiple", form: { "artist-ids": artistIds.join(",") } }),

  unlikeArtists: (artistIds: readonly string[]) =>
    ymRequest<unknown>({ method: "POST", path: "/users/{uid}/likes/artists/remove", form: { "artist-ids": artistIds.join(",") } }),

  likeAlbums: (albumIds: readonly string[]) =>
    ymRequest<unknown>({ method: "POST", path: "/users/{uid}/likes/albums/add-multiple", form: { "album-ids": albumIds.join(",") } }),

  unlikeAlbums: (albumIds: readonly string[]) =>
    ymRequest<unknown>({ method: "POST", path: "/users/{uid}/likes/albums/remove", form: { "album-ids": albumIds.join(",") } }),

  /** Playlist ids are `ownerUid:kind`. */
  likePlaylists: (playlistIds: readonly string[]) =>
    ymRequest<unknown>({ method: "POST", path: "/users/{uid}/likes/playlists/add-multiple", form: { "playlist-ids": playlistIds.join(",") } }),

  unlikePlaylists: (playlistIds: readonly string[]) =>
    ymRequest<unknown>({ method: "POST", path: "/users/{uid}/likes/playlists/remove", form: { "playlist-ids": playlistIds.join(",") } }),

  /** Only the account's own playlists: Rust fills `{uid}`, so another owner's kind never matches. */
  deletePlaylist: (kind: string) =>
    ymRequest<unknown>({ method: "POST", path: `/users/{uid}/playlists/${kind}/delete` }),

  ownPlaylists: () => ymRequest<YmPlaylist[]>({ path: "/users/{uid}/playlists/list" }),

  playlist: (ownerUid: string, kind: string) =>
    ymRequest<YmPlaylist>({ path: `/users/${ownerUid}/playlists/${kind}` }),

  album: (albumId: string) => ymRequest<YmAlbum>({ path: `/albums/${albumId}/with-tracks` }),

  artist: (artistId: string) => ymRequest<YmArtistBriefInfo>({ path: `/artists/${artistId}/brief-info` }),

  /** brief-info lists only the first albums; this is the discography, newest first. */
  artistAlbums: (artistId: string, page: number, pageSize: number) =>
    ymRequest<YmArtistAlbumsPage>({
      path: `/artists/${artistId}/direct-albums`,
      query: { "page": String(page), "page-size": String(pageSize), "sort-by": "year" },
    }),

  /** POST: a liked-tracks list can run to thousands of ids. */
  tracks: (trackIds: readonly string[]) =>
    ymRequest<YmTrack[]>({ method: "POST", path: "/tracks", form: { "track-ids": trackIds.join(",") } }),

  search: (text: string, type: YmSearchType, page: number) =>
    ymRequest<YmSearchResult>({
      path: "/search",
      query: { text, type, page: String(page), nocorrect: "false" },
    }),

  /** A station chain; `queue` is the last track heard, so the chain continues from it. */
  stationTracks: (station: string, queue?: string) =>
    ymRequest<YmStationTracks>({
      path: `/rotor/station/${station}/tracks`,
      query: { settings2: "true", ...(queue ? { queue } : {}) },
    }),

  stationFeedback: (station: string, batchId: string | null, body: Record<string, string>) =>
    ymRequest<unknown>({
      method: "POST",
      path: `/rotor/station/${station}/feedback`,
      ...(batchId ? { query: { "batch-id": batchId } } : {}),
      json: body,
    }),
};
