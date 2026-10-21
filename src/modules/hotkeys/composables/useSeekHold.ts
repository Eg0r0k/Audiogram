import { usePlayerStore } from "@/modules/player/store/player.store";
import type { PlayerTrack } from "@/modules/player/types";
import { SEEK_REPEAT_MS, SEEK_STEP } from "../constants";
import { useHoldRepeat } from "./useHoldRepeat";

const sameTrack = (a: PlayerTrack | null, b: PlayerTrack | null) =>
  !!a && !!b && a.kind === b.kind && a.id === b.id;

/**
 * Seeks one SEEK_STEP when `isHeld` turns true and keeps stepping while it
 * stays true. A hold belongs to the track it started on: it stops at either
 * end of that track and as soon as another one plays, so holding past the end
 * cannot run through the queue, and holding back at the start does not keep
 * replaying its first moments.
 */
export const useSeekHold = (direction: 1 | -1, isHeld: () => boolean) => {
  const player = usePlayerStore();

  // The engine's position moves with the seek itself; the store's follows the
  // next timeupdate, so steps landing before it would all start from one spot.
  const position = () => player.player?.currentTime ?? player.currentTime;

  useHoldRepeat(isHeld, SEEK_REPEAT_MS, () => {
    const heldTrack = player.currentTrack;
    return () => {
      const duration = player.duration;
      if (!player.canSeek || !duration || !sameTrack(player.currentTrack, heldTrack)) return false;
      const target = Math.min(duration, Math.max(0, position() + direction * SEEK_STEP));
      player.seekTo(target);
      return target > 0 && target < duration;
    };
  });
};
