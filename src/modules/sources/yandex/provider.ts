import { errAsync, type ResultAsync } from "neverthrow";
import type { SourceError, SourceProvider } from "../types";
import { isYmAvailable, ymHasPlus } from "./config";

const notYet = <T>(): ResultAsync<T, SourceError> =>
  errAsync<T, SourceError>({ kind: "UNAVAILABLE", message: "Yandex Music catalog is not wired yet" });

/**
 * Registered at bootstrap (src/main.ts). The catalog methods land with the
 * client and the mappers; until then the provider exists so the settings
 * page lists the source and the sign-in has somewhere to live.
 */
export const ymSourceProvider: SourceProvider = {
  id: "ym",

  // Downloads follow the subscription: without Plus Yandex only serves
  // 30-second previews, which are not worth an offline copy.
  get capabilities() {
    return {
      artists: { list: true, open: true },
      albums: { list: true, open: true },
      playlists: { list: true, open: true },
      search: true,
      download: ymHasPlus(),
    };
  },

  get isAvailable() {
    return isYmAvailable();
  },

  searchMode: "submit",

  listArtists: () => notYet(),
  listAlbums: () => notYet(),
  getAlbum: () => notYet(),
  getArtist: () => notYet(),
  listPlaylists: () => notYet(),
  getPlaylist: () => notYet(),
  search: () => notYet(),
  getTrack: () => notYet(),
  coverUrl: () => "",
  resolveStreamUrl: () => notYet(),
  downloadToFile: () => notYet(),
};
