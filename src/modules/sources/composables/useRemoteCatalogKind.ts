import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useRoute } from "vue-router";
import { wantsCatalogView } from "@/app/router/route-locations";
import { useLiveQuery } from "@/composables/useLiveQuery";
import { getAlbumLibraryRow } from "@/queries/album.queries";
import { getArtistLibraryRow } from "@/queries/artist.queries";
import { getPlaylistLibraryRow } from "@/queries/playlist.queries";
import { AlbumId, ArtistId, PlaylistId } from "@/types/ids";
import type { SourceKind } from "@/types/track-ref";
import { remoteCatalogKindOf } from "../lib/catalog-kind";
import type { SourceEntity } from "../types";

//
// Which path a detail page takes for a given id.
//
// A remote-branded id is NOT automatically a catalog entity. Downloading or
// pinning a remote track runs the pin cascade, which creates real Dexie rows
// under the same "nd:"/"yt:" id — and those are library entities: the local
// search index lists them, and opening one must show the library page with
// its downloaded tracks, not the live catalog page.
//
// The two are told apart by `pinned`, exactly as the search index tells them
// apart: a pinned row is a library member, `pinned === 0` is a shadow row
// hanging off a download and carries no library meaning of its own.
//

/**
 * As much of a row as the membership rule below needs to see: it exists, and
 * it may carry a `pinned` flag.
 */
type LibraryRow = { id: string; pinned?: number } | null;

/**
 * Row reads go through the queries layer rather than the repositories, so
 * this composable stays about choosing a path and the Dexie read stays where
 * every other Dexie read in the app lives. The read is live, so a pin or a
 * delete under the id moves the path without an invalidation.
 *
 * Playlists have no `pinned` flag because they have no shadow rows: the pin
 * cascade builds tracks with their albums and artists, never a playlist. So
 * any playlist row that exists is already a library playlist.
 */
const LOOKUP: Record<SourceEntity, {
  read: (id: string) => Promise<LibraryRow>;
  isMember: (row: LibraryRow) => boolean;
}> = {
  artists: {
    read: id => getArtistLibraryRow(ArtistId(id)),
    isMember: row => (row?.pinned ?? 0) !== 0,
  },
  albums: {
    read: id => getAlbumLibraryRow(AlbumId(id)),
    isMember: row => (row?.pinned ?? 0) !== 0,
  },
  playlists: {
    read: id => getPlaylistLibraryRow(PlaylistId(id)),
    isMember: row => row !== null,
  },
};

/**
 * The source to browse this id from, or null for the local Dexie path.
 *
 * Resolution waits for the Dexie lookup so the page never renders the
 * catalog first and swaps to the library row a tick later.
 */
export const useRemoteCatalogKind = (entity: SourceEntity, id: MaybeRefOrGetter<string>) => {
  const route = useRoute();

  // Only a remote-branded id can be ambiguous; a local id is local, and
  // asking Dexie about it would be a pointless round-trip.
  const candidate = computed(() => remoteCatalogKindOf(toValue(id), entity));

  // A link that came from browsing the source asked for the source's view
  // and gets it, downloaded or not; the Dexie lookup is then pointless too.
  const forcedCatalog = computed(() => candidate.value !== null && wantsCatalogView(route.query));

  const lookupId = computed(() =>
    (candidate.value !== null && !forcedCatalog.value ? toValue(id) : null),
  );

  const lookup = LOOKUP[entity];

  const libraryRow = useLiveQuery(
    async () => {
      const current = lookupId.value;
      return current === null ? null : lookup.read(current);
    },
    () => [lookupId.value],
    { enabled: () => lookupId.value !== null },
  );

  // The previous id's row stays until the next read lands; a failed read falls back to the catalog.
  const isResolved = computed(() =>
    lookupId.value === null
    || libraryRow.error.value !== undefined
    || (!libraryRow.isLoading.value && !libraryRow.isStale.value),
  );

  const isLibraryEntity = computed(() =>
    lookupId.value !== null && isResolved.value && lookup.isMember(libraryRow.data.value ?? null),
  );

  const remoteKind = computed<SourceKind | null>(() =>
    (isResolved.value && !isLibraryEntity.value ? candidate.value : null),
  );

  return { remoteKind, isResolved, isLibraryEntity };
};
