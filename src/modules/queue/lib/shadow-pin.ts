import type { PlayerTrack } from "@/modules/player/types";
import { ensurePinnedMany } from "@/modules/tracks/service/ensurePinned";
import type { TrackMenuSubject } from "@/modules/tracks/components/menu/type";
import { getLogger } from "@/lib/logger";

/**
 * Tracks queued straight from live browsing (a remote page's DTO) shadow-pin
 * their rows, so the persisted snapshot — which stores library entries by
 * id only — can restore them next session. Idempotent upserts,
 * fire-and-forget; a failure only means those entries will drop out of the
 * restored queue.
 *
 * One batch, not one call per track: a queued album is hundreds of tracks,
 * and each pin on its own re-reads the whole artists table.
 */
export const shadowPinRemoteTracks = (tracks: readonly PlayerTrack[]): void => {
  const subjects: TrackMenuSubject[] = [];
  for (const track of tracks) {
    if (track.kind !== "library" || !track.sourceDto) continue;
    subjects.push({ kind: "remote", dto: track.sourceDto });
  }
  if (subjects.length === 0) return;

  ensurePinnedMany(subjects, { pinned: 0 }).catch((error) => {
    getLogger().warn(`[Queue] Shadow-pin failed for ${subjects.length} track(s): ${String(error)}`);
  });
};
