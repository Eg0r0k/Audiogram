import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { AlbumId, ArtistId } from "@/types/ids";
import { albumRepository, artistRepository, trackRepository } from "@/db/repositories";
import { storageService } from "@/db/storage";
import type { ArtistEntity } from "@/db/entities";
import type { ArtistData } from "@/components/media-hero/types";
import { getCoverUrl, invalidateCover } from "@/lib/storage";
import { queryKeys } from "@/lib/query-keys";
import { mapTracks } from "@/modules/tracks/lib/mappers";

export interface AlbumWithCover {
  id: AlbumId;
  title: string;
  artistId: ArtistId;
  coverPath?: string;
  coverUrl: string | null;
  year?: number;
}

export function useArtistPage() {
  const route = useRoute();
  const router = useRouter();
  const queryClient = useQueryClient();

  const artistId = computed(() => ArtistId(route.params.id as string));

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: computed(() => queryKeys.artists.detail(artistId.value)),
    queryFn: async () => {
      const artistRes = await artistRepository.findById(artistId.value);
      if (artistRes.isErr()) throw artistRes.error;
      const artist = artistRes.value;
      if (!artist) throw new Error("Artist not found");

      const [albumsRes, tracksRes] = await Promise.all([
        albumRepository.findByArtistId(artistId.value),
        trackRepository.findByArtistId(artistId.value),
      ]);

      const albumEntities = albumsRes.isOk() ? albumsRes.value : [];
      const trackEntities = tracksRes.isOk() ? tracksRes.value : [];

      const albums: AlbumWithCover[] = await Promise.all(
        albumEntities.map(async album => ({
          id: album.id,
          title: album.title,
          artistId: album.artistId,
          coverPath: album.coverPath,
          coverUrl: await getCoverUrl(album.coverPath) ?? null,
          year: album.year,
        })),
      );

      const tracks = mapTracks(trackEntities, [artist], albumEntities);

      return { artist, albums, tracks };
    },
    staleTime: Infinity,
  });

  const artist = computed(() => data.value?.artist ?? null);
  const albums = computed(() => data.value?.albums ?? []);
  const tracks = computed(() => data.value?.tracks ?? []);

  const artistData = computed<ArtistData | null>(() => {
    if (!data.value?.artist) return null;
    return {
      type: "artist",
      id: data.value.artist.id,
      title: data.value.artist.name,
      image: "",
      monthlyListeners: 0,
      isFollowing: false,
    };
  });

  const { mutateAsync: deleteArtist } = useMutation({
    mutationFn: async () => {
      if (!artistId.value) return;
      const albumsRes = await albumRepository.findByArtistId(artistId.value);
      if (albumsRes.isOk()) {
        for (const album of albumsRes.value) {
          if (album.coverPath) {
            invalidateCover(album.coverPath);
            await storageService.deleteFile(album.coverPath);
          }
          await albumRepository.delete(album.id);
        }
      }
      await trackRepository.deleteByArtistId(artistId.value);
      await artistRepository.delete(artistId.value);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.artists.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.albums.all() });
      router.push("/library");
    },
  });

  const { mutateAsync: updateArtist } = useMutation({
    mutationFn: async (changes: Partial<ArtistEntity>) => {
      if (!artistId.value) return;
      const result = await artistRepository.update(artistId.value, changes);
      if (result.isErr()) throw new Error(`Failed to update artist: ${result.error.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.artists.detail(artistId.value) });
      queryClient.invalidateQueries({ queryKey: queryKeys.artists.all() });
    },
  });

  return {
    artist,
    albums,
    tracks,
    artistData,
    isLoading,
    isError,
    error,
    deleteArtist,
    updateArtist,
    refetch,
  };
}
