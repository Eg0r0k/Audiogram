import { type MaybeRefOrGetter } from "vue";
import { useEntityCover } from "./useEntityCover";
import type { AlbumId } from "@/types/ids";

export function useAlbumCover(albumId: MaybeRefOrGetter<AlbumId | null | undefined>) {
  return useEntityCover("album", albumId);
}
