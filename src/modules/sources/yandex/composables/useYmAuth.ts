import { computed } from "vue";
import { getLogger } from "@/lib/logger";
import { queryClient } from "@/queries/client";
import { invalidateSource } from "@/queries/source.queries";
import { forgetSourceHealth } from "@/modules/sources/lib/health";
import { ymAuthCancel, ymAuthLogout, ymAuthStart } from "../api/auth";
import { useYmAuthStore } from "../store/ym-auth.store";

const messageOf = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) return String(error.message);
  return String(error);
};

/**
 * The sign-in actions. Progress arrives over `ym:auth`, which
 * {@link useYmSourceSync} feeds into the store at app root — this composable
 * only starts, stops and ends a session.
 */
export const useYmAuth = () => {
  const store = useYmAuthStore();

  const start = async (): Promise<void> => {
    try {
      const code = await ymAuthStart();
      store.beginPending(code, Date.now());
    }
    catch (error) {
      getLogger().warn(`[YM] Starting the sign-in failed: ${messageOf(error)}`);
      store.failed(messageOf(error));
    }
  };

  const cancel = async (): Promise<void> => {
    try {
      await ymAuthCancel();
    }
    catch (error) {
      getLogger().warn(`[YM] Cancelling the sign-in failed: ${messageOf(error)}`);
    }
    // Rust reports the cancel over the event too; this keeps the card honest
    // even if that event is late.
    store.applyEvent({ status: "cancelled" });
  };

  const logout = async (): Promise<void> => {
    await ymAuthLogout();
    store.signedOut();
    forgetSourceHealth("ym");
    await invalidateSource(queryClient, "ym");
  };

  return {
    loggedIn: computed(() => store.loggedIn),
    hasPlus: computed(() => store.hasPlus),
    displayName: computed(() => store.displayName),
    step: computed(() => store.step),
    start,
    cancel,
    logout,
  };
};
