import { getLogger } from "@/lib/logger";
import { ymApi } from "./api/client";
import { useYmAuthStore } from "./store/ym-auth.store";

export const loadYmLikes = async (): Promise<void> => {
  const result = await ymApi.likedTrackIds();
  if (result.isErr()) {
    getLogger().warn(`[YM] Loading the liked tracks failed (${result.error.kind}): ${result.error.message}`);
    return;
  }
  useYmAuthStore().setLikedTrackIds(result.value);
};
