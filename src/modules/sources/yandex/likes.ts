import { getLogger } from "@/lib/logger";
import { ymApi } from "./api/client";
import { useYmAuthStore } from "./store/ym-auth.store";

/**
 * Pulls the account's liked track ids into the store, so catalog rows can
 * show the right heart without a request each. Called at sign-in and on
 * launch for a restored session; a failure only leaves hearts empty.
 */
export const loadYmLikes = async (): Promise<void> => {
  const result = await ymApi.likedTrackIds();
  if (result.isErr()) {
    getLogger().warn(`[YM] Loading the liked tracks failed (${result.error.kind}): ${result.error.message}`);
    return;
  }
  useYmAuthStore().setLikedTrackIds(result.value);
};
