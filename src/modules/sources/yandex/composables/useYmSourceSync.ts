import { onScopeDispose } from "vue";
import { watchDebounced } from "@vueuse/core";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { getLogger } from "@/lib/logger";
import { queryClient } from "@/queries/client";
import { invalidateSource } from "@/queries/source.queries";
import { checkSource } from "@/modules/sources/composables/useSourceHealth";
import { forgetSourceHealth } from "@/modules/sources/lib/health";
import { useYmSourceSettings } from "@/modules/settings/store/sources";
import { onYmAuthEvent, ymAuthStatus } from "../api/auth";
import { loadYmLikes } from "../likes";
import { useYmAuthStore } from "../store/ym-auth.store";
import type { YmAuthEvent } from "../api/types";

const INVALIDATE_DEBOUNCE_MS = 400;

/**
 * Keeps the frontend's view of the Yandex session in step with Rust: the
 * stored sign-in on launch, then every `ym:auth` event. Runs once at app
 * root (behind `platformCaps.hasMediaServer`) so a session that expires
 * while no settings page is open still reaches the store.
 */
export const useYmSourceSync = () => {
  const store = useYmAuthStore();
  const { enabled } = useYmSourceSettings();

  const dropAnswers = (): void => {
    invalidateSource(queryClient, "ym")
      .catch(error => getLogger().error(`[YM] Dropping the cached data failed: ${String(error)}`));
  };

  const probe = (): void => {
    checkSource("ym")
      .catch(error => getLogger().error(`[YM] Probing the source failed: ${String(error)}`));
  };

  const pullLikes = (): void => {
    loadYmLikes().catch(error => getLogger().error(`[YM] Loading the likes failed: ${String(error)}`));
  };

  ymAuthStatus()
    .then((status) => {
      store.applyStatus(status);
      if (status.loggedIn) pullLikes();
    })
    .catch(error => getLogger().error(`[YM] Reading the stored sign-in failed: ${String(error)}`));

  const onEvent = (event: YmAuthEvent) => {
    store.applyEvent(event);
    // A new account or a dead one: what is cached was answered by the
    // previous session, and so was its health verdict.
    if (event.status === "ok") {
      dropAnswers();
      probe();
      pullLikes();
    }
    else if (event.status === "expired") {
      dropAnswers();
      forgetSourceHealth("ym");
    }
  };

  let unlisten: UnlistenFn | null = null;
  let disposed = false;
  onYmAuthEvent(onEvent)
    .then((stop) => {
      if (disposed) stop();
      else unlisten = stop;
    })
    .catch(error => getLogger().error(`[YM] Subscribing to sign-in events failed: ${String(error)}`));

  onScopeDispose(() => {
    disposed = true;
    unlisten?.();
    unlisten = null;
  });

  // Switching the source off and on: not `immediate`, nothing is cached yet.
  watchDebounced(enabled, () => {
    dropAnswers();
    probe();
  }, { debounce: INVALIDATE_DEBOUNCE_MS });
};
