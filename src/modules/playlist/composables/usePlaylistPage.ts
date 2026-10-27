import { computed, shallowRef, type Ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { PlaylistId } from "@/types/ids";
import { formatTotalDuration } from "@/lib/format/time";
import { getLogger } from "@/lib/logger";
import { useI18n } from "vue-i18n";
import { usePlaylistCover } from "@/modules/covers/composables/usePlaylistCover";
import type { PlaylistData } from "@/types/media-data";
import { queryKeys } from "@/queries/query-keys";
import {
  deletePlaylistAndSync,
  getPlaylistByIdOrThrow,
  getPlaylistLibraryRow,
  getPlaylistPageData,
  readPlaylistTotals,
  readPlaylistTracks,
  removeTrackFromPlaylistAndSync,
  type PlaylistChanges,
  updatePlaylistAndSync,
} from "@/queries/playlist.queries";
import { searchPlaylistTracks } from "@/queries/track.queries";
import { fetchSourcePlaylist } from "@/queries/source.queries";
import { routeLocation } from "@/app/router/route-locations";
import { useLiveQuery } from "@/composables/useLiveQuery";
import type { Track } from "@/types/track";
import type { TrackSortKey } from "@/modules/tracks/types";
import { useLiveTrackList } from "@/modules/tracks/composables/useLiveTrackList";
import { useLiveSearchList } from "@/modules/tracks/composables/useLiveSearchList";
import { useSourcePlaylist, useSourcePlaylistPages } from "@/modules/sources/composables/useSourceCatalog";
import { useCatalogEntity } from "@/modules/sources/composables/useCatalogEntity";
import { pagedPlaylistKindOf } from "@/modules/sources/lib/catalog-kind";
import { sourcePlaylistToPlaylistData, sourceTrackToDisplay } from "@/modules/sources/lib/display";
import type { SourcePlaylistDTO } from "@/modules/sources/types";
import { sources } from "@/modules/sources";
import { formatError } from "@/lib/errors";

export type { PlaylistChanges } from "@/queries/playlist.queries";

interface PlaylistList {
  tracks: Track[];
  count: number;
  seconds: number;
}

export const usePlaylistPage = (sortKey: Ref<TrackSortKey | null>, searchQuery: Ref<string>) => {
  const route = useRoute();
  const normalizedSearchQuery = computed(() => searchQuery.value.trim());
  const isSearching = computed(() => normalizedSearchQuery.value !== "");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useI18n();

  // Pages are keyed by fullPath, so the id is fixed per instance; a page sliding out must not read the next route's id.
  const playlistId = shallowRef(PlaylistId(route.params.id as string));

  // Remote playlists route as "<kind>:<serverId>" — read-only live pages.
  // The provider takes the branded id and unwraps it itself, exactly like
  // getAlbum and getArtist. A pinned library row under the same id wins:
  // that one is a real playlist, not a catalog page.
  const path = useCatalogEntity("playlists", playlistId);
  const { remoteKind, isRemote, remoteId, localEnabled } = path;

  // A source that pages its playlists is browsed page by page; one that does
  // not hands the playlist over whole. Exactly one of the two queries runs —
  // the other parks on skipToken.
  const pagedKind = computed(() =>
    (remoteKind.value ? pagedPlaylistKindOf(playlistId.value) : null),
  );
  const isPaged = computed(() => pagedKind.value !== null);
  const wholeKind = computed(() => (isPaged.value ? null : remoteKind.value));

  const wholeQuery = useSourcePlaylist(wholeKind, computed(() => (isPaged.value ? null : remoteId.value)));
  const pagedQuery = useSourcePlaylistPages(pagedKind, remoteId);

  const remoteState = {
    isLoading: computed(() => (isPaged.value ? pagedQuery.isLoading.value : wholeQuery.isLoading.value)),
    // A failed next page is shown at the end of the list it failed to extend.
    isError: computed(() => (isPaged.value
      ? pagedQuery.isError.value && !pagedQuery.isFetchNextPageError.value
      : wholeQuery.isError.value)),
  };

  const liveHeader = useLiveQuery(
    async () => getPlaylistByIdOrThrow(playlistId.value),
    () => [playlistId.value],
    { enabled: localEnabled },
  );

  // One read for both, so the count and the duration change together.
  const liveTotals = useLiveQuery(
    async () => readPlaylistTotals(playlistId.value),
    () => [playlistId.value],
    { enabled: localEnabled },
  );

  const list = useLiveTrackList({
    read: limit => readPlaylistTracks(playlistId.value, sortKey.value, limit),
    deps: () => [playlistId.value, sortKey.value],
    enabled: computed(() => localEnabled.value && !isSearching.value),
  });

  // A failed re-read keeps the last row, so a playlist deleted under the page stays until the delete navigates away.
  const header = liveHeader.data;
  const headerError = computed(() => (header.value ? undefined : liveHeader.error.value));

  const playlist = path.libraryRow(header);

  const search = useLiveSearchList({
    query: () => normalizedSearchQuery.value,
    sort: () => sortKey.value,
    within: async () => (await getPlaylistLibraryRow(playlistId.value))?.trackIds ?? [],
    enabled: computed(() => !!playlist.value),
  });

  const liveList = computed<PlaylistList | undefined>(() => {
    const totals = liveTotals.data.value;
    return list.isLoading.value || !totals ? undefined : { tracks: list.tracks.value, ...totals };
  });

  // A filtered list reports the matches' own count and duration.
  const searchList = computed<PlaylistList | undefined>(() => {
    const found = search.list.value;
    if (!found) return undefined;
    return { tracks: found.tracks, count: found.total, seconds: found.totalDuration };
  });

  // A sort or search switch keeps the shown list until the next one has its first page.
  const shownList = computed<PlaylistList | undefined>(previous =>
    (isSearching.value ? searchList.value : liveList.value) ?? previous,
  );

  const listError = computed(() => {
    if (isSearching.value) return search.isError.value ? search.error.value : undefined;
    return list.isError.value ? list.error.value : liveTotals.error.value;
  });
  const localError = computed(() => headerError.value ?? listError.value);

  const { isError, isLoading: isPlaylistLoading } = path.pathState(remoteState, {
    isLoading: computed(() => !header.value && headerError.value === undefined),
    isError: computed(() => localError.value !== undefined),
  });

  const remoteDtos = computed(() =>
    (isPaged.value
      ? pagedQuery.data.value?.pages.flatMap(page => page.page.items) ?? []
      : wholeQuery.data.value?.tracks ?? []),
  );

  const remoteMeta = computed<SourcePlaylistDTO | null>(() =>
    (isPaged.value
      ? pagedQuery.data.value?.pages[0]?.playlist ?? null
      : wholeQuery.data.value?.playlist ?? null),
  );

  const remoteTracks = computed(() => remoteDtos.value.map(sourceTrackToDisplay));

  const tracks = computed(() =>
    isRemote.value
      ? remoteTracks.value
      : shownList.value?.tracks ?? [],
  );

  const fetchNextPage = async () => {
    if (isPaged.value) {
      await pagedQuery.fetchNextPage();
      return;
    }
    if (isSearching.value) {
      await search.fetchNextPage();
      return;
    }
    await list.fetchNextPage();
  };
  const hasNextPage = computed(() => {
    if (isPaged.value) return pagedQuery.hasNextPage.value;
    return isSearching.value ? search.hasNextPage.value : list.hasNextPage.value;
  });
  const isFetchingNextPage = computed(() => {
    if (isPaged.value) return pagedQuery.isFetchingNextPage.value;
    return isSearching.value ? search.isFetchingNextPage.value : list.isFetchingNextPage.value;
  });
  const isFetchNextPageError = computed(() => {
    if (isPaged.value) return pagedQuery.isFetchNextPageError.value;
    return isSearching.value ? search.isFetchNextPageError.value : list.isFetchNextPageError.value;
  });
  // On the whole-playlist path the tracks came with the playlist itself, so
  // there is no second load to wait on.
  const isTracksLoading = computed(() => {
    if (isPaged.value) return pagedQuery.isLoading.value;
    return isRemote.value ? false : shownList.value === undefined && localError.value === undefined;
  });

  /**
   * Sorting is a library feature: Dexie sorts by index across every page, so
   * the answer covers the whole list and costs nothing to produce. A catalog
   * list would have to be re-sorted in the browser over whatever has been
   * fetched — expensive on a long list and wrong on a paged one — so a remote
   * page keeps the order its source gave it. A playlist imported into the
   * library is a library playlist and sorts like one.
   */
  const canSort = computed(() => !isRemote.value);

  const trackCount = computed(() => {
    if (!isRemote.value) {
      return shownList.value?.count ?? playlist.value?.trackIds.length ?? 0;
    }
    // While a cursor remains, the source's own count is the only estimate of
    // the whole; once it runs out the loaded rows ARE the playlist.
    if (isPaged.value && hasNextPage.value) {
      return remoteMeta.value?.trackCount ?? remoteTracks.value.length;
    }
    return remoteTracks.value.length;
  });

  const totalDuration = computed(() =>
    formatTotalDuration(
      isRemote.value
        ? remoteTracks.value.reduce((sum, track) => sum + track.duration, 0)
        : shownList.value?.seconds ?? 0,
      t,
    ),
  );

  const {
    url: coverUrl,
    isLoading: isCoverLoading,
  } = usePlaylistCover(playlistId);

  const isLoading = computed(() =>
    isPlaylistLoading.value || isCoverLoading.value || isTracksLoading.value,
  );

  const error = computed(() => localError.value ?? list.error.value);

  const refetch = () => {
    liveHeader.refetch();
    liveTotals.refetch();
    if (isSearching.value) {
      search.refetch();
      return;
    }
    list.refetch();
  };

  const playlistDetailData = computed<PlaylistData | null>(() => {
    if (isRemote.value) {
      const remotePlaylist = remoteMeta.value;
      if (!remotePlaylist) return null;
      return {
        ...sourcePlaylistToPlaylistData(remotePlaylist, playlistId.value),
        trackCount: trackCount.value,
        duration: totalDuration.value,
      };
    }
    const current = playlist.value;
    if (!current) return null;

    return {
      type: "playlist",
      id: current.id,
      title: current.name,
      image: coverUrl.value ?? "",
      isOwner: true,
      trackCount: trackCount.value,
      duration: totalDuration.value,
      description: current.description,
    };
  });

  const loadAllTracks = async (): Promise<Track[]> => {
    const kind = pagedKind.value;
    if (kind) {
      const whole = await fetchSourcePlaylist(queryClient, kind, playlistId.value);
      return whole.tracks.map(sourceTrackToDisplay);
    }
    const current = playlist.value;
    if (!current) return [];
    const query = normalizedSearchQuery.value;
    if (query) {
      return (await searchPlaylistTracks(current.id, query, 0, Infinity, sortKey.value)).tracks;
    }
    return (await getPlaylistPageData(current.id, sortKey.value)).tracks;
  };

  const { mutateAsync: deletePlaylist } = useMutation({
    mutationFn: (options: { deleteTracks?: boolean } = {}) =>
      deletePlaylistAndSync(playlist.value, options),
    onSuccess: () => {
      router.push(routeLocation.home())
        .catch(error => getLogger().error(`[Playlist] Navigation home after delete failed: ${formatError(error)}`));
    },
  });

  const sourceProvider = computed(() => (remoteKind.value ? sources.find(remoteKind.value) : undefined));

  /** An own, non-system catalog playlist whose source can delete it — the only delete a remote page offers. */
  const canDeleteAtSource = computed(() =>
    isRemote.value && !!remoteMeta.value?.isOwner && !remoteMeta.value.isSystem && !!sourceProvider.value?.deletePlaylist,
  );

  const deleteAtSource = async (): Promise<boolean> => {
    const kind = remoteKind.value;
    const provider = sourceProvider.value;
    if (!kind || !provider?.deletePlaylist) return false;
    const result = await provider.deletePlaylist(playlistId.value);
    if (result.isErr()) {
      getLogger().warn(`[Playlist] Deleting ${playlistId.value} at ${kind} failed (${result.error.kind}): ${result.error.message}`);
      return false;
    }
    await queryClient.invalidateQueries({ queryKey: queryKeys.source.playlists(kind) });
    router.push(routeLocation.home())
      .catch(error => getLogger().error(`[Playlist] Navigation home after delete failed: ${formatError(error)}`));
    return true;
  };

  const { mutateAsync: updatePlaylist } = useMutation({
    mutationFn: async (changes: PlaylistChanges) => {
      const current = playlist.value;
      if (!current) {
        return;
      }

      return updatePlaylistAndSync(current, changes);
    },
  });

  const { mutateAsync: removeTrack } = useMutation({
    mutationFn: (trackId: string) =>
      removeTrackFromPlaylistAndSync(playlistId.value, trackId),
  });

  return {
    remoteKind,
    playlist,
    tracks,
    canSort,
    normalizedSearchQuery,
    /** True when `tracks` already holds the playlist whole. */
    isComplete: computed(() => !isPaged.value && isRemote.value),
    loadAllTracks,
    playlistData: playlistDetailData,
    coverUrl,
    trackCount,
    totalDuration,
    isLoading,
    isError,
    error,
    deletePlaylist,
    canDeleteAtSource,
    deleteAtSource,
    updatePlaylist,
    removeTrack,
    refetch,
    fetchNextPage,
    hasNextPage,
    isTracksLoading,
    isFetchingNextPage,
    isFetchNextPageError,
  };
};
