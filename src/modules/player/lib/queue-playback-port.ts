import type { PlaybackPort } from "@/modules/queue/lib/playback-port";
import { usePlayerStore } from "../store/player.store";

// Resolves the store per call so registering the port instantiates nothing
// and spies on the store instance keep working.
export const createPlayerPlaybackPort = (): PlaybackPort => ({
  get currentTrack() {
    return usePlayerStore().currentTrack;
  },
  get currentTime() {
    return usePlayerStore().currentTime;
  },
  get canSeek() {
    return usePlayerStore().canSeek;
  },
  get isPlaybackIntended() {
    return usePlayerStore().isPlaybackIntended;
  },
  presentTrack: track => usePlayerStore().presentTrack(track),
  selectTrack: track => usePlayerStore().selectTrack(track),
  playPlayerTrack: track => usePlayerStore().playPlayerTrack(track),
  restartCurrent: () => usePlayerStore().restartCurrent(),
  stop: () => usePlayerStore().stop(),
  clearCurrentTrack: () => usePlayerStore().clearCurrentTrack(),
  seekTo: seconds => usePlayerStore().seekTo(seconds),
});
