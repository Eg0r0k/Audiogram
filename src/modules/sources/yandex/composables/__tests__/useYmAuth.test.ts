import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const invokeCommand = vi.hoisted(() => vi.fn());
const invalidateSource = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("@/app/tauri-commands", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/tauri-commands")>();
  return { ...actual, invokeCommand, listenEvent: vi.fn(() => Promise.resolve(() => {})) };
});
vi.mock("@/queries/source.queries", () => ({ invalidateSource }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }) }));

import { useYmAuthStore } from "../../store/ym-auth.store";
import { useYmAuth } from "../useYmAuth";

const CODE = { userCode: "fzlazd3z", verificationUrl: "https://ya.ru/device", expiresIn: 300, interval: 5 };

describe("useYmAuth", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    invokeCommand.mockReset();
    invalidateSource.mockClear();
  });

  it("start asks Rust for a device code and shows it as pending", async () => {
    invokeCommand.mockResolvedValue(CODE);
    const { start } = useYmAuth();

    await start();

    expect(invokeCommand).toHaveBeenCalledWith("ym_auth_start");
    const step = useYmAuthStore().step;
    expect(step.kind).toBe("pending");
    expect(step.kind === "pending" && step.userCode).toBe("fzlazd3z");
  });

  it("a start that Rust rejects lands in the error step, not in pending", async () => {
    invokeCommand.mockRejectedValue({ kind: "NETWORK", message: "offline" });
    const { start } = useYmAuth();

    await start();

    expect(useYmAuthStore().step).toEqual({ kind: "error", message: "offline" });
  });

  it("cancel stops the poll on the Rust side", async () => {
    invokeCommand.mockResolvedValue(undefined);
    const { cancel } = useYmAuth();

    await cancel();

    expect(invokeCommand).toHaveBeenCalledWith("ym_auth_cancel");
  });

  it("logout forgets the session and drops what the account answered", async () => {
    invokeCommand.mockResolvedValue(undefined);
    const store = useYmAuthStore();
    store.applyStatus({ loggedIn: true, uid: 42, hasPlus: true, displayName: "Tester" });
    const { logout } = useYmAuth();

    await logout();

    expect(invokeCommand).toHaveBeenCalledWith("ym_auth_logout");
    expect(store.loggedIn).toBe(false);
    expect(invalidateSource).toHaveBeenCalledWith(expect.anything(), "ym");
  });
});
