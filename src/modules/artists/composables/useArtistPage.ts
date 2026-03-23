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

  const {
    data: artist,
    isLoading: isArtistLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: computed(() => queryKeys.artists.detail(artistId.value)),
    queryFn: async () => {
      const res = await artistRepository.findById(artistId.value);
      if (res.isErr()) throw res.error;
      if (!res.value) throw new Error("Artist not found");
      return res.value;
    },
  });

  const { data: albumsData, isLoading: isAlbumsLoading } = useQuery({
    queryKey: computed(() => queryKeys.artists.albums(artistId.value)),
    queryFn: async () => {
      const res = await albumRepository.findByArtistId(artistId.value);
      if (res.isErr()) throw res.error;

      const entities = res.value;
      const withCovers: AlbumWithCover[] = await Promise.all(
        entities.map(async album => ({
          id: album.id,
          title: album.title,
          artistId: album.artistId,
          coverPath: album.coverPath,
          coverUrl: await getCoverUrl(album.coverPath) ?? null,
          year: album.year,
        })),
      );

      return { entities, withCovers };
    },
    enabled: computed(() => !!artist.value),
  });

  const { data: rawTracks, isLoading: isTracksLoading } = useQuery({
    queryKey: computed(() => queryKeys.artists.tracks(artistId.value)),
    queryFn: async () => {
      const res = await trackRepository.findByArtistId(artistId.value);
      if (res.isErr()) throw res.error;
      return res.value;
    },
    enabled: computed(() => !!artist.value),
  });

  const isLoading = computed(
    () => isArtistLoading.value || isAlbumsLoading.value || isTracksLoading.value,
  );

  const albums = computed(() => albumsData.value?.withCovers ?? []);

  const tracks = computed(() => {
    if (!rawTracks.value || !artist.value || !albumsData.value) return [];
    return mapTracks(rawTracks.value, [artist.value], albumsData.value.entities);
  });

  const artistData = computed<ArtistData | null>(() => {
    if (!artist.value) return null;
    return {
      type: "artist",
      id: artist.value.id,
      title: artist.value.name,
      image: "",
      monthlyListeners: 0,
      isFollowing: false,
    };
  });

  const { mutateAsync: deleteArtist } = useMutation({
    mutationFn: async () => {
      const albumEntities = albumsData.value?.entities ?? [];

      for (const album of albumEntities) {
        if (album.coverPath) {
          invalidateCover(album.coverPath);
          await storageService.deleteFile(album.coverPath);
        }
        await albumRepository.delete(album.id);
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
