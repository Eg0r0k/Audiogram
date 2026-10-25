import type { QueryClient } from "@tanstack/vue-query";
import type { Track } from "@/types/track";
import { toggleTrackLikeAndSync } from "@/queries/track.queries";
import { invalidateLibraryData } from "@/queries/library.queries";
import { unwrapSourceResult } from "@/queries/shared";
import { sources } from "@/modules/sources";
import { sourceKindOfId } from "@/types/track-ref";
import { ensurePinned } from "./ensurePinned";

export interface ToggleTrackLikeDeps {
  queryClient: QueryClient;
  syncTrackMetadata: (track: Track) => void;
}

export const toggleTrackLike = async (
  track: Track,
  { queryClient, syncTrackMetadata }: ToggleTrackLikeDeps,
): Promise<Track> => {
  const liked = !track.isLiked;

  // A catalog row has no Dexie row until something pins it. A like needs
  // one to carry likedAt, but it is NOT library membership: the row, its
  // album and its artist stay shadows and the artist link keeps opening
  // the catalog.
  if (track.sourceDto) {
    await ensurePinned({ kind: "remote", dto: track.sourceDto }, { pinned: 0 });
    if (liked) await invalidateLibraryData(queryClient);
  }

  // The source's own like list first: a refusal leaves the row as it was.
  const kind = sourceKindOfId(track.id);
  const provider = kind === "local" ? undefined : sources.find(kind);
  if (provider?.setTrackLiked) {
    await unwrapSourceResult(provider.setTrackLiked(track.id, liked), kind);
  }

  const nextTrack = await toggleTrackLikeAndSync(queryClient, track);

  track.isLiked = nextTrack.isLiked;

  // The now-playing UI reads the queue's copy of the current track.
  syncTrackMetadata(nextTrack);

  return nextTrack;
};
