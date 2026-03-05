import type { AlbumId, ArtistId, PlaylistId, QueueItemId } from "@/types/ids";
import type { PlayerTrack } from "@/modules/player/types";

export type QueueSource
  = | { type: "album"; albumId: AlbumId }
    | { type: "playlist"; playlistId: PlaylistId }
    | { type: "artist"; artistId: ArtistId }
    | { type: "search" }
    | { type: "manual" }
    | { type: "liked" }
    | { type: "unknown" };

export interface QueueItem {
  id: QueueItemId;
  track: PlayerTrack;
  source: QueueSource;
  addedAt: number;
}
