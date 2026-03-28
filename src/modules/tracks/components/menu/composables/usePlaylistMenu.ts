import { computed } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import {
  createPlaylistAndSync,
  playlistQueries,
} from "@/queries/playlist.queries";

export function usePlaylistMenu() {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const { data: playlistsData, isLoading } = useQuery({
    ...playlistQueries.all(),
    staleTime: Infinity,
  });

  const playlists = computed(() =>
    (playlistsData.value ?? []).map(p => ({ id: p.id, name: p.name })),
  );

  async function handleCreatePlaylist() {
    try {
      await createPlaylistAndSync(queryClient);
    }
    catch {
      toast.error(t("playlist.createFailed"));
    }
  }

  return {
    playlists,
    isLoading,
    handleCreatePlaylist,
  };
}
