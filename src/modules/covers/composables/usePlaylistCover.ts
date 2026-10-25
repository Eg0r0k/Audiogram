import { type MaybeRefOrGetter } from "vue";
import { useEntityCover } from "./useEntityCover";
import type { PlaylistId } from "@/types/ids";
import type { Nullish } from "@/types/utils";

export function usePlaylistCover(playlistId: MaybeRefOrGetter<Nullish<PlaylistId>>) {
  return useEntityCover("playlist", playlistId);
}
