import { computed, type MaybeRefOrGetter } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { toaster } from "@/app/toaster";
import { useI18n } from "vue-i18n";
import {
  createPlaylistAndSync,
  playlistQueries,
} from "@/queries/playlist.queries";

interface UsePlaylistMenuOptions {
  enabled?: MaybeRefOrGetter<boolean>;
}

export function usePlaylistMenu(options: UsePlaylistMenuOptions = {}) {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const { data: playlistsData, isLoading } = useQuery({
    ...playlistQueries.all(),
    staleTime: Infinity,
    enabled: options.enabled ?? true,
  });

  const playlists = computed(() =>
    (playlistsData.value ?? []).map(p => ({ id: p.id, name: p.name })),
  );

  async function handleCreatePlaylist() {
    try {
      await createPlaylistAndSync(queryClient);
    }
    catch {
      toaster.add({ title: t("playlist.createFailed"), color: "destructive" });
    }
  }

  return {
    playlists,
    isLoading,
    handleCreatePlaylist,
  };
}
