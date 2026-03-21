import type { AlbumId, ArtistId, PlaylistId } from "@/types/ids";

export const queryKeys = {
  artists: {
    all: () => ["artists"] as const,
    detail: (id: ArtistId) => ["artists", id] as const,
    albums: (id: ArtistId) => ["artists", id, "albums"] as const,
    tracks: (id: ArtistId) => ["artists", id, "tracks"] as const,
  },
  albums: {
    all: () => ["albums"] as const,
    detail: (id: AlbumId) => ["albums", id] as const,
    tracks: (id: AlbumId) => ["albums", id, "tracks"] as const,
  },
  playlists: {
    all: () => ["playlists"] as const,
    detail: (id: PlaylistId) => ["playlists", id] as const,
    tracks: (id: PlaylistId) => ["playlists", id, "tracks"] as const,
  },
} as const;
