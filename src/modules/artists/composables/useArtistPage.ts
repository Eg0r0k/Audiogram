import { computed, shallowRef, type Ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/vue-query";
import { ArtistId } from "@/types/ids";
import type { ArtistData } from "@/types/media-data";
import type { Track } from "@/types/track";
import { queryKeys } from "@/queries/query-keys";
import { getLogger } from "@/lib/logger";
import { useEntityCover } from "@/modules/covers/composables/useEntityCover";
import {
  artistTrackScope,
  deleteArtistAndSync,
  getArtistByIdOrThrow,
  readArtistAlbums,
  readArtistTracks,
  type ArtistChanges,
  updateArtistAndSync,
} from "@/queries/artist.queries";
import { searchArtistTracks } from "@/queries/track.queries";
import { statsQueries } from "@/queries/stats.queries";
import { routeLocation } from "@/app/router/route-locations";
import { useLiveQuery } from "@/composables/useLiveQuery";
import type { TrackSortKey } from "@/modules/tracks/types";
import { useLiveTrackList } from "@/modules/tracks/composables/useLiveTrackList";
import { useSourceArtist } from "@/modules/sources/composables/useSourceCatalog";
import { useCatalogEntity } from "@/modules/sources/composables/useCatalogEntity";
import { THUMB_SIZE_CARD } from "@/lib/media/cover-sizes";
import { sourceArtistToArtistData, sourceCoverUrl, sourceTrackToDisplay } from "@/modules/sources/lib/display";
import type { SourceAlbumDTO } from "@/modules/sources/types";
import type { AlbumEntity } from "@/db/entities";
import type { LibraryItem } from "@/modules/library/types";
import { formatError } from "@/lib/errors";

export type { ArtistChanges } from "@/queries/artist.queries";

/** Entity-shaped view of a remote album so the page's album cards keep working. */
function sourceAlbumToLibraryAlbum(dto: SourceAlbumDTO): AlbumEntity {
  return {
    id: dto.id,
    title: dto.title,
    artistId: dto.artistId ?? ArtistId(""),
    year: dto.year,
    pinned: 0,
    addedAt: 0,
    updatedAt: 0,
  };
}

interface ArtistList {
  tracks: Track[];
  count: number;
}

export const useArtistPage = (sortKey: Ref<TrackSortKey | null>, searchQuery: Ref<string>) => {
  const route = useRoute();
  const normalizedSearchQuery = computed(() => searchQuery.value.trim());
  const isSearching = computed(() => normalizedSearchQuery.value !== "");
  const router = useRouter();
  const queryClient = useQueryClient();

  // Pages are keyed by fullPath, so the id is fixed per instance; a page sliding out must not read the next route's id.
  const artistId = shallowRef(ArtistId(route.params.id as string));

  const path = useCatalogEntity("artists", artistId);
  const { remoteKind, isRemote, remoteId, localEnabled } = path;

  const remoteQuery = useSourceArtist(remoteKind, remoteId);

  const liveArtist = useLiveQuery(
    async () => getArtistByIdOrThrow(artistId.value),
    () => [artistId.value],
    { enabled: localEnabled },
  );

  // An artist's own rows are few, so its track count stays live.
  const liveTrackCount = useLiveQuery(
    async () => artistTrackScope(artistId.value).members().count(),
    () => [artistId.value],
    { enabled: localEnabled },
  );

  const liveAlbums = useLiveQuery(
    async () => readArtistAlbums(artistId.value),
    () => [artistId.value],
    { enabled: localEnabled },
  );

  const list = useLiveTrackList({
    read: limit => readArtistTracks(artistId.value, sortKey.value, limit),
    deps: () => [artistId.value, sortKey.value],
    enabled: computed(() => localEnabled.value && !isSearching.value),
  });

  // A failed re-read keeps the last row, so an artist deleted under the page stays until the delete navigates away.
  const artistRow = liveArtist.data;
  const headerError = computed(() => (artistRow.value ? undefined : liveArtist.error.value));

  const artist = path.libraryRow(artistRow);

  const {
    data: searchData,
    isError: isSearchError,
    isFetchNextPageError: isSearchFetchNextPageError,
    error: searchError,
    refetch: refetchSearch,
    fetchNextPage: fetchNextSearchPage,
    hasNextPage: hasNextSearchPage,
    isFetchingNextPage: isFetchingNextSearchPage,
  } = useInfiniteQuery({
    queryKey: computed(() => queryKeys.artists.tracksPage(artistId.value, sortKey.value, normalizedSearchQuery.value)),
    queryFn: ({ pageParam }) =>
      searchArtistTracks(artistId.value, normalizedSearchQuery.value, pageParam, undefined, sortKey.value),
    initialPageParam: 0,
    getNextPageParam: lastPage => lastPage.nextOffset,
    enabled: computed(() => !!artist.value && isSearching.value),
  });

  const liveList = computed<ArtistList | undefined>(() => {
    const count = liveTrackCount.data.value;
    return list.isLoading.value || count === undefined ? undefined : { tracks: list.tracks.value, count };
  });

  // A filtered list reports the matches' own count.
  const searchList = computed<ArtistList | undefined>(() => {
    const data = searchData.value;
    if (!data) return undefined;
    const [first] = data.pages;
    return { tracks: data.pages.flatMap(page => page.tracks), count: first.total };
  });

  // A sort or search switch keeps the shown list until the next one has its first page.
  const shownList = computed<ArtistList | undefined>(previous =>
    (isSearching.value ? searchList.value : liveList.value) ?? previous,
  );

  // TanStack reports "no error" as null; the live reads as undefined.
  const listError = computed(() => {
    if (isSearching.value) {
      return isSearchError.value && !isSearchFetchNextPageError.value ? searchError.value ?? undefined : undefined;
    }
    return list.isError.value ? list.error.value : liveTrackCount.error.value;
  });
  const localError = computed(() => headerError.value ?? listError.value ?? liveAlbums.error.value);

  const { isError, isLoading: isArtistLoading } = path.pathState(remoteQuery, {
    isLoading: computed(() => !artistRow.value && headerError.value === undefined),
    isError: computed(() => localError.value !== undefined),
  });

  // A catalog artist has no Dexie rows to page through; its top tracks ride
  // along with getArtist. Sources without such a notion omit the field, and
  // the section is simply empty for them.
  const tracks = computed(() =>
    (isRemote.value
      ? (remoteQuery.data.value?.tracks ?? []).map(sourceTrackToDisplay)
      : shownList.value?.tracks ?? []),
  );

  const canSort = computed(() => !isRemote.value);

  const remoteAlbums = computed(() => remoteQuery.data.value?.albums ?? []);

  // Entity-shaped album rows drop coverRef — proxy the URLs separately.
  const albumCovers = computed(() => new Map(
    remoteAlbums.value
      .filter(album => album.coverRef)
      .map(album => [
        album.id,
        sourceCoverUrl(remoteKind.value ?? "local", album.coverRef, THUMB_SIZE_CARD),
      ] as const),
  ));

  const albums = computed(() =>
    isRemote.value
      ? remoteAlbums.value.map(sourceAlbumToLibraryAlbum)
      : liveAlbums.data.value ?? [],
  );

  // The shelf reads every album of the artist at once, so it never has a next page.
  const hasNextAlbumPage = computed(() => false);
  const isFetchingNextAlbumPage = computed(() => false);
  const fetchNextAlbumPage = () => Promise.resolve();

  // A shelf only catalog artists have: sources that carry no artist
  // playlists omit the field and the section never renders.
  const playlistItems = computed<LibraryItem[]>(() =>
    (remoteQuery.data.value?.playlists ?? []).map(playlist => ({
      id: playlist.id,
      type: "playlist",
      title: playlist.name,
      image: sourceCoverUrl(remoteKind.value ?? "local", playlist.coverRef, THUMB_SIZE_CARD) || undefined,
      isPinned: false,
      isCatalog: true,
      addedAt: 0,
      updatedAt: 0,
      to: routeLocation.playlist(playlist.id, { catalog: true }),
      rounded: false,
      trackCount: playlist.trackCount,
    })),
  );

  const trackCount = computed(
    () => (isRemote.value ? 0 : shownList.value?.count ?? 0),
  );

  const albumCount = computed(() =>
    isRemote.value
      ? remoteQuery.data.value?.artist.albumCount ?? remoteAlbums.value.length
      : liveAlbums.data.value?.length ?? 0,
  );

  const {
    url: coverUrl,
    isLoading: isCoverLoading,
  } = useEntityCover("artist", artistId);

  const { data: playsCount } = useQuery(
    computed(() => statsQueries.artistPlays(artistId.value)),
  );

  const isTracksLoading = computed(() =>
    !isRemote.value && shownList.value === undefined && localError.value === undefined,
  );

  const isShelfLoading = computed(() =>
    !isRemote.value && liveAlbums.data.value === undefined && localError.value === undefined,
  );

  const isLoading = computed(
    () => isArtistLoading.value || isCoverLoading.value || isTracksLoading.value || isShelfLoading.value,
  );

  const error = computed(() => localError.value ?? list.error.value);

  const artistDataMapped = computed<ArtistData | null>(() => {
    if (isRemote.value) {
      const remoteArtist = remoteQuery.data.value?.artist;
      return remoteArtist ? sourceArtistToArtistData(remoteArtist) : null;
    }
    if (!artist.value) return null;

    return {
      type: "artist",
      id: artist.value.id,
      title: artist.value.name,
      image: coverUrl.value ?? "",
      monthlyListeners: playsCount.value ?? 0,
      isFollowing: false,
      bio: artist.value.bio,
    };
  });

  const hasNextTrackPage = computed(() => isSearching.value ? hasNextSearchPage.value : list.hasNextPage.value);
  const isFetchingNextTrackPage = computed(() => isSearching.value
    ? isFetchingNextSearchPage.value
    : list.isFetchingNextPage.value);
  const isFetchNextTrackPageError = computed(() => isSearching.value
    ? isSearchFetchNextPageError.value
    : list.isFetchNextPageError.value);

  const fetchNextTrackPage = async () => {
    if (isSearching.value) {
      await fetchNextSearchPage();
      return;
    }
    await list.fetchNextPage();
  };

  const refetch = async () => {
    liveArtist.refetch();
    liveTrackCount.refetch();
    liveAlbums.refetch();
    if (isSearching.value) {
      await refetchSearch();
      return;
    }
    list.refetch();
  };

  const { mutateAsync: deleteArtist } = useMutation({
    mutationFn: (options: { deleteTracks?: boolean } = {}) =>
      deleteArtistAndSync(queryClient, artist.value, options),
    onSuccess: () => {
      router.push(routeLocation.home())
        .catch(error => getLogger().error(`[Artist] Navigation home after delete failed: ${formatError(error)}`));
    },
  });

  const { mutateAsync: updateArtist } = useMutation({
    mutationFn: async (changes: ArtistChanges) => {
      const current = artist.value;
      if (!current) {
        return;
      }

      return updateArtistAndSync(queryClient, current, changes);
    },
  });

  return {
    remoteKind,
    artist,
    albums,
    albumCovers,
    playlistItems,
    tracks,
    canSort,
    normalizedSearchQuery,
    artistData: artistDataMapped,
    coverUrl,
    trackCount,
    albumCount,
    isLoading,
    isError,
    error,
    deleteArtist,
    updateArtist,
    refetch,
    fetchNextTrackPage,
    hasNextTrackPage,
    isTracksLoading,
    isFetchingNextTrackPage,
    isFetchNextTrackPageError,
    fetchNextAlbumPage,
    hasNextAlbumPage,
    isFetchingNextAlbumPage,
  };
};
