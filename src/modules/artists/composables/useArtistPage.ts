import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { ArtistId } from "@/types/ids";
import { albumRepository, artistRepository, trackRepository } from "@/db/repositories";
import { storageService } from "@/db/storage";
import type { ArtistEntity } from "@/db/entities";
import type { Track } from "@/modules/player/types";
import type { ArtistData } from "@/components/media-hero/types";

export interface AlbumWithCover {
  id: string;
  title: string;
  artistId: string;
  coverUrl: string | null;
  year?: number;
}

export function useArtistPage() {
  const route = useRoute();
  const router = useRouter();
  const queryClient = useQueryClient();

  const artistId = computed(() => ArtistId(route.params.id as string));

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["artist-page", artistId],
    queryFn: async () => {
      const artistRes = await artistRepository.findById(artistId.value);
      if (artistRes.isErr()) throw artistRes.error;
      const artist = artistRes.value;
      if (!artist) throw new Error("Artist not found");

      const albumsRes = await albumRepository.findByArtistId(artistId.value);
      const albumEntities = albumsRes.isOk() ? albumsRes.value : [];

      const tracksRes = await trackRepository.findByArtistId(artistId.value);
      const trackEntities = tracksRes.isOk() ? tracksRes.value : [];

      const albums: AlbumWithCover[] = await Promise.all(
        albumEntities.map(async (album) => {
          let coverUrl: string | null = null;

          if (album.coverPath) {
            const urlResult = await storageService.getAudioUrl(album.coverPath);
            coverUrl = urlResult.isOk() ? urlResult.value : null;
          }

          return {
            id: album.id,
            title: album.title,
            artistId: album.artistId,
            coverUrl,
            year: album.year,
          };
        }),
      );

      const albumsMap = new Map(albumEntities.map(a => [a.id, a]));

      const tracks = await Promise.all(
        trackEntities.map(async (entity) => {
          const urlResult = await storageService.getAudioUrl(entity.storagePath);
          if (urlResult.isErr()) return null;

          const album = albumsMap.get(entity.albumId);

          return {
            id: entity.id,
            title: entity.title,
            artist: artist.name,
            artistId: entity.artistId,
            albumId: entity.albumId,
            albumName: album?.title ?? "Unknown",
            cover: undefined,
            url: urlResult.value,
            duration: entity.duration,
            isLiked: entity.isLiked,
          } as Track;
        }),
      );

      return {
        artist,
        albums,
        tracks: tracks.filter((t): t is Track => t !== null),
      };
    },
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

      if (data.value?.albums) {
        for (const album of data.value.albums) {
          if (album.coverUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(album.coverUrl);
          }
        }
      }

      await trackRepository.deleteByArtistId(artistId.value);

      const albumsRes = await albumRepository.findByArtistId(artistId.value);
      if (albumsRes.isOk()) {
        for (const album of albumsRes.value) {
          if (album.coverPath) {
            await storageService.deleteFile(album.coverPath);
          }
          await albumRepository.delete(album.id);
        }
      }

      await artistRepository.delete(artistId.value);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artists"] });
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      router.push("/library");
    },
  });

  const { mutateAsync: updateArtist } = useMutation({
    mutationFn: async (changes: Partial<ArtistEntity>) => {
      if (!artistId.value) return;
      const updateResult = await artistRepository.update(artistId.value, changes);
      if (updateResult.isErr()) {
        throw new Error(`Failed to update artist: ${updateResult.error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artist-page", artistId] });
      queryClient.invalidateQueries({ queryKey: ["artists"] });
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
