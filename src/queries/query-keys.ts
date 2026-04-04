import type { AlbumId, ArtistId, PlaylistId, TrackId } from "@/types/ids";

export const queryKeys = {
  library: {
    summary: () => ["library", "summary"] as const,
  },
  artists: {
    all: () => ["artists"] as const,
    detail: (id: ArtistId) => ["artists", id] as const,
    albums: (id: ArtistId) => ["artists", id, "albums"] as const,
    tracks: (id: ArtistId) => ["artists", id, "tracks"] as const,
    page: (id: ArtistId) => ["artists", id, "page"] as const,
    tracksPage: (id: ArtistId) => ["artists", id, "tracks", "page"] as const,
  },
  albums: {
    all: () => ["albums"] as const,
    detail: (id: AlbumId) => ["albums", id] as const,
    tracks: (id: AlbumId) => ["albums", id, "tracks"] as const,
    cover: (id: AlbumId) => ["covers", "album", id] as const,
    page: (id: AlbumId) => ["albums", id, "page"] as const,
    tracksPage: (id: AlbumId) => ["albums", id, "tracks", "page"] as const,
  },
  playlists: {
    all: () => ["playlists"] as const,
    detail: (id: PlaylistId) => ["playlists", id] as const,
    tracks: (id: PlaylistId) => ["playlists", id, "tracks"] as const,
    cover: (id: PlaylistId) => ["covers", "playlist", id] as const,
    page: (id: PlaylistId) => ["playlists", id, "page"] as const,
    tracksPage: (id: PlaylistId) => ["playlists", id, "tracks", "page"] as const,
  },
  tracks: {
    all: () => ["tracks"] as const,
    detail: (id: TrackId) => ["tracks", id] as const,
    liked: () => ["tracks", "liked"] as const,
    likedPage: () => ["tracks", "liked", "page"] as const,
    likedPageInfinite: () => ["tracks", "liked", "page", "infinite"] as const,
  },
  covers: {
    detail: (ownerType: "album" | "playlist", ownerId: string) =>
      ["covers", ownerType, ownerId] as const,
  },
  stats: {
    all: () => ["stats"] as const,
    topTracks: (limit: number, since?: number) =>
      ["stats", "topTracks", limit, since] as const,
    topTracksMeta: (ids: readonly string[]) =>
      ["stats", "topTracksMeta", ...ids] as const,
    topArtists: (limit: number, since?: number) =>
      ["stats", "topArtists", limit, since] as const,
    topArtistsMeta: (ids: readonly string[]) =>
      ["stats", "topArtistsMeta", ...ids] as const,
    totalTime: (since?: number) => ["stats", "totalTime", since] as const,
    dailyActivity: (days: number) => ["stats", "dailyActivity", days] as const,
  },
} as const;
