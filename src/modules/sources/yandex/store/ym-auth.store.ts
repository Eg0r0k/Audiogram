import { defineStore } from "pinia";
import { computed, ref, shallowRef } from "vue";
import type { YmAuthEvent, YmAuthStatus, YmDeviceCode } from "../api/types";

/**
 * Where the sign-in stands. `pending` holds the code the user is typing at
 * Yandex; `expired` is a working session that stopped working (shown as a
 * banner until the user signs in again or dismisses it by signing out).
 */
export type YmAuthStep
  = | { kind: "idle" }
    | { kind: "pending"; userCode: string; verificationUrl: string; expiresAt: number }
    | { kind: "codeExpired" }
    | { kind: "error"; message: string }
    | { kind: "expired" };

/**
 * Who is signed in to Yandex Music, as far as the frontend may know: no
 * token ever lands here. Not persisted — Rust restores the session from its
 * own store on launch and `useYmSourceSync` copies the status over.
 */
export const useYmAuthStore = defineStore("ym-auth", () => {
  const loggedIn = ref(false);
  const uid = ref<number | null>(null);
  const hasPlus = ref(false);
  const displayName = ref<string | null>(null);
  const step = ref<YmAuthStep>({ kind: "idle" });
  // Raw Yandex ids of the account's liked tracks — what a catalog row's
  // heart starts from. Replaced whole on load, patched on each toggle.
  const likedTrackIds = shallowRef<ReadonlySet<string>>(new Set());

  const isPending = computed(() => step.value.kind === "pending");

  const setLikedTrackIds = (ids: Iterable<string>) => {
    likedTrackIds.value = new Set(ids);
  };

  const markTrackLiked = (id: string, liked: boolean) => {
    const next = new Set(likedTrackIds.value);
    if (liked) next.add(id);
    else next.delete(id);
    likedTrackIds.value = next;
  };

  const setAccount = (next: { uid: number; hasPlus: boolean; displayName: string }) => {
    loggedIn.value = true;
    uid.value = next.uid;
    hasPlus.value = next.hasPlus;
    displayName.value = next.displayName;
  };

  const clearAccount = () => {
    loggedIn.value = false;
    uid.value = null;
    hasPlus.value = false;
    displayName.value = null;
    likedTrackIds.value = new Set();
  };

  const applyStatus = (status: YmAuthStatus) => {
    if (status.loggedIn && status.uid !== null) {
      setAccount({ uid: status.uid, hasPlus: status.hasPlus, displayName: status.displayName ?? "" });
    }
    else {
      clearAccount();
    }
  };

  const beginPending = (code: YmDeviceCode, now: number) => {
    step.value = {
      kind: "pending",
      userCode: code.userCode,
      verificationUrl: code.verificationUrl,
      expiresAt: now + code.expiresIn * 1000,
    };
  };

  const failed = (message: string) => {
    step.value = { kind: "error", message };
  };

  const applyEvent = (event: YmAuthEvent) => {
    switch (event.status) {
      case "pending":
        // The code is already on screen when the poll starts; nothing new.
        break;
      case "ok":
        setAccount(event);
        step.value = { kind: "idle" };
        break;
      case "cancelled":
        step.value = { kind: "idle" };
        break;
      case "codeExpired":
        step.value = { kind: "codeExpired" };
        break;
      case "expired":
        clearAccount();
        step.value = { kind: "expired" };
        break;
      case "error":
        step.value = { kind: "error", message: event.message };
        break;
    }
  };

  const signedOut = () => {
    clearAccount();
    step.value = { kind: "idle" };
  };

  return {
    loggedIn,
    uid,
    hasPlus,
    displayName,
    step,
    isPending,
    likedTrackIds,
    setLikedTrackIds,
    markTrackLiked,
    applyStatus,
    beginPending,
    failed,
    applyEvent,
    signedOut,
  };
});
