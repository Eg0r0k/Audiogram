import type { Result } from "neverthrow";
import {
  buildAlbumDoc,
  buildAllSearchDocuments,
  buildArtistDoc,
  buildPlaylistDoc,
  buildTrackDoc,
  documentId,
  isLibraryMember,
} from "./buildDocuments";
import { createSearchEngine, type SearchEngine } from "./searchEngine";
import type { SearchDocument, SearchEntityType, SearchFilter, SearchOptions, SearchResponse } from "./types";
import { db } from "@/db";
import { albumRepository, artistRepository, playlistRepository, trackRepository } from "@/db/repositories";
import { countTrackDocuments, trackProjectionMismatch } from "./projectionCheck";
import { matchesByEntity } from "./searchMatches";
import { mapTracks, type Track } from "@/types/track";
import type { AlbumId, ArtistId, PlaylistId, TrackId } from "@/types/ids";

let engine: SearchEngine | null = null;
let initPromise: Promise<SearchEngine> | null = null;

/**
 * Discards the in-session index without rebuilding. The next search (or
 * explicit rebuild) starts from a fresh full scan of the database.
 */
export function resetSearchIndex(): void {
  engine = null;
  initPromise = null;
}

/** Dev-only projection check; must never break search init. */
async function assertProjectionInDev(documents: SearchDocument[]): Promise<void> {
  if (!import.meta.env.DEV) return;
  try {
    // The index carries library members only — compare against that count.
    const dbTrackCount = await db.tracks.where("pinned").equals(1).count();
    const drift = trackProjectionMismatch(dbTrackCount, countTrackDocuments(documents));
    if (drift) console.error(drift);
  }
  catch {
    // Counting failed — nothing useful to report.
  }
}

const ensureEngine = (): Promise<SearchEngine> => {
  if (engine) return Promise.resolve(engine);
  if (initPromise) return initPromise;

  initPromise = buildAllSearchDocuments()
    .then(async (documents) => {
      const built = createSearchEngine();
      built.build(documents);
      engine = built;
      await assertProjectionInDev(documents);
      return built;
    })
    .catch((err: unknown) => {
      initPromise = null;
      throw err;
    });

  return initPromise;
};

export async function initSearchIndex(): Promise<void> {
  await ensureEngine();
}

export async function searchDocuments(
  query: string,
  filter: SearchFilter,
  options?: SearchOptions,
): Promise<SearchResponse> {
  return (await ensureEngine()).search(query, filter, options);
}

async function hydrateTracksByIds(ids: TrackId[]): Promise<Track[]> {
  if (ids.length === 0) return [];

  const entitiesResult = await trackRepository.findByIds(ids);
  if (entitiesResult.isErr()) throw entitiesResult.error;
  const entities = entitiesResult.value;

  const artistIds = [...new Set(entities.flatMap(entity => entity.artistIds))];
  const albumIds = [...new Set(entities.map(entity => entity.albumId))];

  const [artistsResult, albumsResult] = await Promise.all([
    artistRepository.findByIds(artistIds),
    albumRepository.findByIds(albumIds),
  ]);
  if (artistsResult.isErr()) throw artistsResult.error;
  if (albumsResult.isErr()) throw albumsResult.error;

  return mapTracks(entities, artistsResult.value, albumsResult.value);
}

export async function searchTracks(
  query: string,
  offset = 0,
  limit?: number,
) {
  const response = await searchDocuments(query, "track", { offset, limit });

  // Invariant: the search document is only a matching/rendering source. Playable
  // tracks are hydrated from the DB by entityId, so paths stay current after a
  // folder relink or REMOTE_HLS TTL expiry. Order follows the search score.
  const ids = response.results.map(item => item.entityId as TrackId);
  const tracks = await hydrateTracksByIds(ids);

  return {
    tracks,
    total: response.total,
    totalDuration: response.totalDuration,
    matches: matchesByEntity(response.results),
  };
}

export interface SearchIndexChanges {
  tracks?: readonly TrackId[];
  albums?: readonly AlbumId[];
  artists?: readonly ArtistId[];
  playlists?: readonly PlaylistId[];
}

const readRows = async <TEntity, TId>(
  repository: { findByIds: (ids: TId[]) => Promise<Result<TEntity[], Error>> },
  ids: TId[],
): Promise<TEntity[]> => {
  if (ids.length === 0) return [];
  const result = await repository.findByIds(ids);
  if (result.isErr()) throw result.error;
  return result.value;
};

/**
 * Makes the index match the rows under these ids: a library member is
 * (re)indexed with current names, a missing row or a non-member is dropped.
 * A track brings its artist and album rows along.
 */
export const syncSearchIndex = async (changes: SearchIndexChanges): Promise<void> => {
  const trackIds = [...new Set(changes.tracks ?? [])];
  const playlistIds = [...new Set(changes.playlists ?? [])];
  const requestedAlbumIds = changes.albums ?? [];
  const requestedArtistIds = changes.artists ?? [];
  if (trackIds.length + playlistIds.length + requestedAlbumIds.length + requestedArtistIds.length === 0) return;

  const [tracks, playlists] = await Promise.all([
    readRows(trackRepository, trackIds),
    readRows(playlistRepository, playlistIds),
  ]);
  const albumIds = [...new Set([...requestedAlbumIds, ...tracks.map(track => track.albumId)])].filter(Boolean);
  const albums = await readRows(albumRepository, albumIds);
  const artistIds = [...new Set([...requestedArtistIds, ...tracks.flatMap(track => track.artistIds)])];
  // Album captions need the album's artist even when that artist is not synced.
  const artists = await readRows(artistRepository, [...new Set([...artistIds, ...albums.map(album => album.artistId)])]);
  const artistMap = new Map(artists.map(artist => [artist.id, artist]));
  const albumMap = new Map(albums.map(album => [album.id, album]));
  const trackMap = new Map(tracks.map(track => [track.id, track]));
  const playlistMap = new Map(playlists.map(playlist => [playlist.id, playlist]));

  const documents: SearchDocument[] = [];
  const dropped: string[] = [];
  const reconcile = <TRow extends { id: string }>(
    type: SearchEntityType,
    ids: readonly string[],
    rows: ReadonlyMap<string, TRow>,
    toDocument: (row: TRow) => SearchDocument | null,
  ) => {
    for (const id of ids) {
      const row = rows.get(id);
      const document = row ? toDocument(row) : null;
      if (document) documents.push(document);
      else dropped.push(documentId(type, id));
    }
  };

  reconcile("artist", artistIds, artistMap, artist => (isLibraryMember(artist) ? buildArtistDoc(artist) : null));
  reconcile("album", albumIds, albumMap, album => (isLibraryMember(album) ? buildAlbumDoc(album, artistMap) : null));
  reconcile("track", trackIds, trackMap, track => (isLibraryMember(track) ? buildTrackDoc(track, artistMap, albumMap) : null));
  reconcile("playlist", playlistIds, playlistMap, buildPlaylistDoc);

  const live = await ensureEngine();
  live.remove(dropped);
  live.upsert(documents);
};

export async function rebuildSearchIndex() {
  resetSearchIndex();
  await initSearchIndex();
}
