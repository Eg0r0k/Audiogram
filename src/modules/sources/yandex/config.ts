import { platformCaps } from "@/lib/environment/platformCaps";
import { useSettingsStore } from "@/modules/settings/store";
import { useYmAuthStore } from "./store/ym-auth.store";

/**
 * Whether the Yandex source can answer right now: a media server to stream
 * through, the source switched on, and an account signed in. Reads the
 * stores in try/catch like `getNdConfig` — a provider can be asked before
 * Pinia is up.
 */
export const isYmAvailable = (): boolean => {
  if (!platformCaps.hasMediaServer) return false;
  try {
    return useSettingsStore().sources.ym.enabled && useYmAuthStore().loggedIn;
  }
  catch {
    return false;
  }
};

/** Whether the signed-in account has Plus — full tracks and downloads. */
export const ymHasPlus = (): boolean => {
  try {
    return useYmAuthStore().hasPlus;
  }
  catch {
    return false;
  }
};

/** A live `account/status` answer knows the current subscription better than the stored one. */
export const setYmHasPlus = (hasPlus: boolean): void => {
  try {
    useYmAuthStore().hasPlus = hasPlus;
  }
  catch {
    // noop
  }
};
