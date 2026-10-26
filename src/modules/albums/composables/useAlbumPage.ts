import { computed, shallowRef, type Ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { AlbumId } from "@/types/ids";
import type { AlbumData } from "@/types/media-data";
import type { Track } from "@/types/track";
import { queryKeys } from "@/queries/query-keys";
import { formatTotalDuration } from "@/lib/format/time";
import { getLogger } from "@/lib/logger";
import { useI18n } from "vue-i18n";
import {
  albumTrackScope,
  deleteAlbumAndSync,
  getAlbumByIdOrThrow,
  readAlbumTracks,
  type AlbumChanges,
  updateAlbumAndSync,
} from "@/queries/album.queries";
import { searchAlbumTracks } from "@/queries/track.queries";
import { getArtistLibraryRow } from "@/queries/artist.queries";
import { routeLocation } from "@/app/router/route-locations";
import { useLiveQuery } from "@/composables/useLiveQuery";
import type { TrackSortKey } from "@/modules/tracks/types";
import { useLiveTrackList } from "@/modules/tracks/composables/useLiveTrackList";
import { useSourceAlbum } from "@/modules/sources/composables/useSourceCatalog";
import { useCatalogEntity } from "@/modules/sources/composables/useCatalogEntity";
import { sourceAlbumToAlbumData, sourceTrackToDisplay } from "@/modules/sources/lib/display";
import { useEntityCover } from "@/modules/covers/composables/useEntityCover";
import { formatError } from "@/lib/errors";

export type { AlbumChanges } from "@/queries/album.queries";

interface AlbumList {
  tracks: Track[];
  count: number;
  seconds: number;
}

export const useAlbumPage = (sortKey: Ref<TrackSortKey | null>, searchQuery: Ref<string>) => {
  const route = useRoute();
  const normalizedSearchQuery = computed(() => searchQuery.value.trim());
  const isSearching = computed(() => normalizedSearchQuery.value !== "");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useI18n();

  // Pages are keyed by fullPath, so the id is fixed per instance; a page sliding out must not read the next route's id.
  const albumId = shallowRef(AlbumId(route.params.id as string));

  const path = useCatalogEntity("albums", albumId);
  const { remoteKind, isRemote, remoteId, localEnabled } = path;

  const remoteQuery = useSourceAlbum(remoteKind, remoteId);

  const liveHeader = useLiveQuery(
    async () => {
      const album = await getAlbumByIdOrThrow(albumId.value);
      return { album, artist: await getArtistLibraryRow(album.artistId) };
    },
    () => [albumId.value],
    { enabled: localEnabled },
  );

  // An album's own rows are few, so its count and duration stay live.
  const liveTotals = useLiveQuery(
    async () => {
      const members = albumTrackScope(albumId.value).members();
      return { count: await members.count(), seconds: await members.sumDuration() };
    },
    () => [albumId.value],
    { enabled: localEnabled },
  );

  const list = useLiveTrackList({
    read: limit => readAlbumTracks(albumId.value, sortKey.value, limit),
    deps: () => [albumId.value, sortKey.value],
    enabled: computed(() => localEnabled.value && !isSearching.value),
  });

  // A failed re-read keeps the last row, so an album deleted under the page stays until the delete navigates away.
  const header = liveHeader.data;
  const headerError = computed(() => (header.value ? undefined : liveHeader.error.value));

  const album = path.libraryRow(computed(() => header.value?.album));

  const artist = computed(() => {
    const row = header.value?.artist;
    return row ? { id: row.id, name: row.name } : null;
  });

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
    queryKey: computed(() => queryKeys.albums.tracksPage(albumId.value, sortKey.value, normalizedSearchQuery.value)),
    queryFn: ({ pageParam }) =>
      searchAlbumTracks(albumId.value, normalizedSearchQuery.value, pageParam, undefined, sortKey.value),
    initialPageParam: 0,
    getNextPageParam: lastPage => lastPage.nextOffset,
    enabled: computed(() => !!album.value && isSearching.value),
  });

  const liveList = computed<AlbumList | undefined>(() => {
    const totals = liveTotals.data.value;
    return list.isLoading.value || !totals ? undefined : { tracks: list.tracks.value, ...totals };
  });

  // A filtered list reports the matches' own count and duration.
  const searchList = computed<AlbumList | undefined>(() => {
    const data = searchData.value;
    if (!data) return undefined;
    const [first] = data.pages;
    return {
      tracks: data.pages.flatMap(page => page.tracks),
      count: first.total,
      seconds: first.totalDuration ?? liveTotals.data.value?.seconds ?? 0,
    };
  });

  // A sort or search switch keeps the shown list until the next one has its first page.
  const shownList = computed<AlbumList | undefined>(previous =>
    (isSearching.value ? searchList.value : liveList.value) ?? previous,
  );

  // TanStack reports "no error" as null; the live reads as undefined.
  const listError = computed(() => {
    if (isSearching.value) {
      return isSearchError.value && !isSearchFetchNextPageError.value ? searchError.value ?? undefined : undefined;
    }
    return list.isError.value ? list.error.value : liveTotals.error.value;
  });
  const localError = computed(() => headerError.value ?? listError.value);

  const { isError, isLoading: isAlbumLoading } = path.pathState(remoteQuery, {
    isLoading: computed(() => !header.value && headerError.value === undefined),
    isError: computed(() => localError.value !== undefined),
  });

  const remoteTracks = computed(() =>
    (remoteQuery.data.value?.tracks ?? []).map(sourceTrackToDisplay),
  );

  /**
   * Sorting is a library feature: Dexie sorts by index across every page. A
   * catalog album would have to be re-sorted in the browser, so it keeps the
   * order its source gave it — which for an album is the track order anyway.
   */
  const canSort = computed(() => !isRemote.value);

  const tracks = computed(() =>
    isRemote.value ? remoteTracks.value : shownList.value?.tracks ?? [],
  );

  const trackCount = computed(() =>
    isRemote.value ? remoteTracks.value.length : shownList.value?.count ?? 0,
  );

  const totalDuration = computed(() =>
    formatTotalDuration(
      isRemote.value
        ? remoteTracks.value.reduce((sum, track) => sum + track.duration, 0)
        : shownList.value?.seconds ?? 0,
      t,
    ),
  );

  const isTracksLoading = computed(() =>
    !isRemote.value && shownList.value === undefined && localError.value === undefined,
  );

  // Remote albums show their source's art; only a library album has a
  // Dexie cover to look up.
  const { url: coverUrl, isLoading: isCoverLoading } = useEntityCover(
    () => (isRemote.value ? null : "album"),
    albumId,
  );

  const isLoading = computed(() =>
    isAlbumLoading.value || isCoverLoading.value || isTracksLoading.value,
  );

  const error = computed(() => localError.value ?? list.error.value);

  const albumDataMapped = computed<AlbumData | null>(() => {
    if (isRemote.value) {
      const remoteAlbum = remoteQuery.data.value?.album;
      return remoteAlbum ? sourceAlbumToAlbumData(remoteAlbum, totalDuration.value) : null;
    }
    if (!album.value) return null;

    return {
      type: "album",
      id: album.value.id,
      title: album.value.title,
      artistName: artist.value?.name ?? "",
      artistId: album.value.artistId,
      image: coverUrl.value ?? "",
      releaseYear: album.value.year ?? 0,
      trackCount: trackCount.value,
      duration: totalDuration.value,
    };
  });

  const hasNextPage = computed(() => isSearching.value ? hasNextSearchPage.value : list.hasNextPage.value);
  const isFetchingNextPage = computed(() => isSearching.value ? isFetchingNextSearchPage.value : list.isFetchingNextPage.value);
  const isFetchNextPageError = computed(() => isSearching.value
    ? isSearchFetchNextPageError.value
    : list.isFetchNextPageError.value);

  const fetchNextPage = async () => {
    if (isSearching.value) {
      await fetchNextSearchPage();
      return;
    }
    await list.fetchNextPage();
  };

  const refetch = async () => {
    liveHeader.refetch();
    liveTotals.refetch();
    if (isSearching.value) {
      await refetchSearch();
      return;
    }
    list.refetch();
  };

  const { mutateAsync: deleteAlbum } = useMutation({
    mutationFn: (options: { deleteTracks?: boolean } = {}) =>
      deleteAlbumAndSync(queryClient, album.value, options),
    onSuccess: () => {
      router.push(routeLocation.home())
        .catch(error => getLogger().error(`[Album] Navigation home after delete failed: ${formatError(error)}`));
    },
  });

  const { mutateAsync: updateAlbum } = useMutation({
    mutationFn: async (changes: AlbumChanges) => {
      const current = album.value;
      if (!current) {
        return;
      }

      return updateAlbumAndSync(queryClient, current, changes);
    },
  });

  return {
    remoteKind,
    album,
    tracks,
    canSort,
    normalizedSearchQuery,
    albumData: albumDataMapped,
    coverUrl,
    trackCount,
    isLoading,
    isError,
    error,
    deleteAlbum,
    updateAlbum,
    refetch,
    fetchNextPage,
    hasNextPage,
    isTracksLoading,
    isFetchingNextPage,
    isFetchNextPageError,
  };
};
