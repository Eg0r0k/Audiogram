import type { AlbumId, ArtistId, TrackId } from "@/types/ids";
import type { SourceKind } from "@/types/track-ref";

export const queryKeys = {
  recommendations: {
    all: () => ["recommendations"] as const,
    forTrack: (trackId: TrackId, limit: number) =>
      ["recommendations", "forTrack", trackId, limit] as const,
  },
  source: {
    /** Every remote catalog answer, whatever source it came from. */
    all: () => ["source"] as const,
    /** One source's slice of the above. */
    ofKind: (kind: SourceKind) => ["source", kind] as const,
    artists: (kind: SourceKind | null) => ["source", kind, "artists"] as const,
    /** Every album page of a source, whatever the sort — the prefix of albumsInf. */
    albums: (kind: SourceKind | null) => ["source", kind, "albums"] as const,
    albumsInf: (kind: SourceKind | null, sort: string) => ["source", kind, "albums", sort] as const,
    // Null ids come from skipToken-parked options.
    album: (kind: SourceKind | null, id: AlbumId | null) => ["source", kind, "album", id] as const,
    artist: (kind: SourceKind | null, id: ArtistId | null) => ["source", kind, "artist", id] as const,
    playlists: (kind: SourceKind | null) => ["source", kind, "playlists"] as const,
    playlist: (kind: SourceKind | null, id: string | null) => ["source", kind, "playlist", id] as const,
    playlistMeta: (kind: SourceKind | null, id: string | null) => ["source", kind, "playlist", id, "meta"] as const,
    playlistPages: (kind: SourceKind | null, id: string | null) => ["source", kind, "playlist", id, "pages"] as const,
    search: (kind: SourceKind | null, q: string) => ["source", kind, "search", q] as const,
    searchPages: (kind: SourceKind | null, scope: string, q: string) =>
      ["source", kind, "search", q, "pages", scope] as const,
  },
  youtube: {
    all: () => ["youtube"] as const,
    /**
     * Plain-video search — the one YouTube query with no generic counterpart.
     * Music search caches under queryKeys.source like every other source's,
     * and so do albums, artists and playlists, whatever source they came from.
     */
    videoSearch: (query: string) => ["youtube", "search", "videos", query] as const,
  },
  stats: {
    all: () => ["stats"] as const,
    /** Raw listen events of a period — the shared read behind the aggregates below. */
    events: (since?: number) => ["stats", "events", since] as const,
    hasHistory: () => ["stats", "hasHistory"] as const,
    topTracks: (limit: number, since?: number) =>
      ["stats", "topTracks", limit, since] as const,
    topTracksMeta: (ids: readonly string[]) =>
      ["stats", "topTracksMeta", ...ids] as const,
    topArtists: (limit: number, since?: number) =>
      ["stats", "topArtists", limit, since] as const,
    artistPlays: (artistId: string) =>
      ["stats", "artistPlays", artistId] as const,
    topGenres: (limit: number, since?: number) => ["stats", "topGenres", limit, since] as const,
    totalTime: (since?: number) => ["stats", "totalTime", since] as const,
    totalBetween: (from: number, to: number) => ["stats", "totalBetween", from, to] as const,
    dailyActivity: (days: number) => ["stats", "dailyActivity", days] as const,
    recentHistory: (limit: number) => ["stats", "recentHistory", limit] as const,
    summary: (since?: number) => ["stats", "summary", since] as const,
    hourlyActivity: (since?: number) => ["stats", "hourlyActivity", since] as const,
    records: (since?: number) => ["stats", "records", since] as const,
    streaks: () => ["stats", "streaks"] as const,
  },
} as const;
