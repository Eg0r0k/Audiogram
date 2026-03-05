import type { PlayerTrack } from "@/modules/player/types";
import { storageService } from "@/db/storage";

export interface ResolvedAudioSource {
  type: "url" | "file";
  url?: string;
  file?: File;
}

export async function resolveTrackSource(
  track: PlayerTrack,
): Promise<ResolvedAudioSource | null> {
  if ("file" in track && track.file) {
    return { type: "file", file: track.file };
  }

  if (track.url) {
    return { type: "url", url: track.url };
  }

  if ("storagePath" in track && track.storagePath) {
    const result = await storageService.getAudioUrl(track.storagePath);

    if (result.isOk()) {
      return { type: "url", url: result.value };
    }

    console.error("Failed to resolve storage path:", result.error);
    return null;
  }

  return null;
}
