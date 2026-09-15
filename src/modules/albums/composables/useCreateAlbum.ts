import { useQueryClient } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { routeLocation } from "@/app/router/route-locations";
import { createAlbumAndSync } from "@/queries/album.queries";
import type { ArtistId } from "@/types/ids";

export const useCreateAlbum = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { t } = useI18n();

  return async (artistId: ArtistId) => {
    const album = await createAlbumAndSync(queryClient, artistId, t("album.newAlbum"));
    await router.push(routeLocation.album(album.id));
  };
};
