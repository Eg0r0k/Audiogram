import { type MaybeRefOrGetter } from "vue";
import { useEntityCover } from "./useEntityCover";
import type { PlaylistId } from "@/types/ids";

export function usePlaylistCover(playlistId: MaybeRefOrGetter<PlaylistId | null | undefined>) {
  return useEntityCover("playlist", playlistId);
}
