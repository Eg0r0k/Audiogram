import { computed } from "vue";
import { useRouter } from "vue-router";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { playlistRepository } from "@/db/repositories/playlist.repository";
import { queryKeys } from "@/lib/query-keys";
import { PlaylistId } from "@/types/ids";

export function usePlaylistMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const { data: playlistsData, isLoading } = useQuery({
    queryKey: queryKeys.playlists.all(),
    queryFn: async () => {
      const result = await playlistRepository.findAll();
      if (result.isErr()) throw result.error;
      return result.value;
    },
    staleTime: Infinity,
  });

  const playlists = computed(() =>
    (playlistsData.value ?? []).map(p => ({ id: p.id, name: p.name })),
  );

  async function handleCreatePlaylist() {
    const id = PlaylistId(crypto.randomUUID());
    const now = Date.now();

    const result = await playlistRepository.create({
      id,
      name: "New playlist",
      trackIds: [],
      addedAt: now,
      updatedAt: now,
    });

    if (result.isErr()) {
      toast.error(t("playlist.createFailed"));
      return;
    }

    queryClient.invalidateQueries({ queryKey: queryKeys.playlists.all() });
    router.push({ name: "playlist", params: { id } });
  }

  return {
    playlists,
    isLoading,
    handleCreatePlaylist,
  };
}
