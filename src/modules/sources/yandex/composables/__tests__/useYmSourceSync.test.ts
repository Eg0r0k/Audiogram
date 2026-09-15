import { effectScope, nextTick, type EffectScope } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { YmAuthEvent } from "../../api/types";

const invokeCommand = vi.hoisted(() => vi.fn());
const listeners = vi.hoisted(() => ({ ymAuth: null as ((event: { payload: unknown }) => void) | null }));
const invalidateSource = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const checkSource = vi.hoisted(() => vi.fn(() => Promise.resolve({ state: "ok" })));
const forgetSourceHealth = vi.hoisted(() => vi.fn());

vi.mock("@/app/tauri-commands", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/tauri-commands")>();
  return {
    ...actual,
    invokeCommand,
    listenEvent: vi.fn((name: string, handler: (event: { payload: unknown }) => void) => {
      if (name === "ym:auth") listeners.ymAuth = handler;
      return Promise.resolve(() => { listeners.ymAuth = null; });
    }),
  };
});
vi.mock("@/queries/source.queries", () => ({ invalidateSource }));
vi.mock("@/modules/sources/composables/useSourceHealth", () => ({ checkSource }));
vi.mock("@/modules/sources/lib/health", () => ({ forgetSourceHealth }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }) }));

import { useYmAuthStore } from "../../store/ym-auth.store";
import { useYmSourceSync } from "../useYmSourceSync";

const emit = (event: YmAuthEvent) => listeners.ymAuth?.({ payload: event });

describe("useYmSourceSync", () => {
  let scope: EffectScope | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    invokeCommand.mockReset();
    invalidateSource.mockClear();
    checkSource.mockClear();
    forgetSourceHealth.mockClear();
    listeners.ymAuth = null;
  });

  afterEach(() => {
    scope?.stop();
    scope = null;
    vi.useRealTimers();
  });

  const run = () => {
    scope = effectScope();
    scope.run(() => useYmSourceSync());
  };

  it("restores the stored sign-in on launch without dropping anything", async () => {
    invokeCommand.mockResolvedValue({ loggedIn: true, uid: 42, hasPlus: true, displayName: "Tester" });

    run();
    await vi.advanceTimersByTimeAsync(0);

    expect(invokeCommand).toHaveBeenCalledWith("ym_auth_status");
    expect(useYmAuthStore().loggedIn).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(invalidateSource).not.toHaveBeenCalled();
  });

  it("a confirmed sign-in reaches the store, drops stale answers and probes the source", async () => {
    invokeCommand.mockResolvedValue({ loggedIn: false, uid: null, hasPlus: false, displayName: null });
    run();
    await vi.advanceTimersByTimeAsync(0);

    emit({ status: "ok", uid: 42, hasPlus: true, displayName: "Tester" });
    await nextTick();
    await vi.advanceTimersByTimeAsync(500);

    expect(useYmAuthStore().loggedIn).toBe(true);
    expect(invalidateSource).toHaveBeenCalledWith(expect.anything(), "ym");
    expect(checkSource).toHaveBeenCalledWith("ym");
  });

  it("an expired session signs out, shows the banner and forgets the old verdict", async () => {
    invokeCommand.mockResolvedValue({ loggedIn: true, uid: 42, hasPlus: true, displayName: "Tester" });
    run();
    await vi.advanceTimersByTimeAsync(0);

    emit({ status: "expired" });
    await nextTick();
    await vi.advanceTimersByTimeAsync(500);

    const store = useYmAuthStore();
    expect(store.loggedIn).toBe(false);
    expect(store.step).toEqual({ kind: "expired" });
    expect(invalidateSource).toHaveBeenCalledWith(expect.anything(), "ym");
    expect(forgetSourceHealth).toHaveBeenCalledWith("ym");
  });

  it("stops listening when its scope ends", async () => {
    invokeCommand.mockResolvedValue({ loggedIn: false, uid: null, hasPlus: false, displayName: null });
    run();
    await vi.advanceTimersByTimeAsync(0);
    expect(listeners.ymAuth).not.toBeNull();

    scope?.stop();
    scope = null;
    await vi.advanceTimersByTimeAsync(0);

    expect(listeners.ymAuth).toBeNull();
  });
});
