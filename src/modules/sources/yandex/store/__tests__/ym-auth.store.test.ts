import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useYmAuthStore } from "../ym-auth.store";

const CODE = { userCode: "fzlazd3z", verificationUrl: "https://ya.ru/device", expiresIn: 300, interval: 5 };

describe("ym-auth store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("starts signed out and idle", () => {
    const store = useYmAuthStore();

    expect(store.loggedIn).toBe(false);
    expect(store.hasPlus).toBe(false);
    expect(store.step).toEqual({ kind: "idle" });
  });

  it("takes the stored status from the backend on launch", () => {
    const store = useYmAuthStore();

    store.applyStatus({ loggedIn: true, uid: 42, hasPlus: true, displayName: "Tester" });

    expect(store.loggedIn).toBe(true);
    expect(store.uid).toBe(42);
    expect(store.hasPlus).toBe(true);
    expect(store.displayName).toBe("Tester");
  });

  it("holds the device code while the user confirms it", () => {
    const store = useYmAuthStore();

    store.beginPending(CODE, 1_000_000);

    expect(store.step).toEqual({
      kind: "pending",
      userCode: "fzlazd3z",
      verificationUrl: "https://ya.ru/device",
      expiresAt: 1_000_000 + 300_000,
    });
  });

  it("a confirmed sign-in records the account and returns to idle", () => {
    const store = useYmAuthStore();
    store.beginPending(CODE, 0);

    store.applyEvent({ status: "ok", uid: 42, hasPlus: false, displayName: "Tester" });

    expect(store.loggedIn).toBe(true);
    expect(store.uid).toBe(42);
    expect(store.hasPlus).toBe(false);
    expect(store.step).toEqual({ kind: "idle" });
  });

  it("a cancelled poll returns to idle without signing in", () => {
    const store = useYmAuthStore();
    store.beginPending(CODE, 0);

    store.applyEvent({ status: "cancelled" });

    expect(store.loggedIn).toBe(false);
    expect(store.step).toEqual({ kind: "idle" });
  });

  it("an unconfirmed code reports its expiry, a rejected sign-in its message", () => {
    const store = useYmAuthStore();

    store.beginPending(CODE, 0);
    store.applyEvent({ status: "codeExpired" });
    expect(store.step).toEqual({ kind: "codeExpired" });

    store.beginPending(CODE, 0);
    store.applyEvent({ status: "error", message: "The user denied the request" });
    expect(store.step).toEqual({ kind: "error", message: "The user denied the request" });
  });

  it("an expired session signs the account out and says so", () => {
    const store = useYmAuthStore();
    store.applyStatus({ loggedIn: true, uid: 42, hasPlus: true, displayName: "Tester" });

    store.applyEvent({ status: "expired" });

    expect(store.loggedIn).toBe(false);
    expect(store.uid).toBeNull();
    expect(store.step).toEqual({ kind: "expired" });
  });

  it("a pending event does not disturb a code already shown", () => {
    const store = useYmAuthStore();
    store.beginPending(CODE, 0);

    store.applyEvent({ status: "pending" });

    expect(store.step.kind).toBe("pending");
  });

  it("signing out clears the account and any banner", () => {
    const store = useYmAuthStore();
    store.applyStatus({ loggedIn: true, uid: 42, hasPlus: true, displayName: "Tester" });
    store.applyEvent({ status: "expired" });

    store.signedOut();

    expect(store.loggedIn).toBe(false);
    expect(store.step).toEqual({ kind: "idle" });
  });
});
