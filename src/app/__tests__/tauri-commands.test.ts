import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke, isTauri: () => false }));

import { COMMANDS, invokeCommand, PlatformUnavailableError } from "../tauri-commands";

describe("invokeCommand", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
  });

  it("forwards the command name and its arguments", async () => {
    mocks.invoke.mockResolvedValue("https://x");

    await expect(invokeCommand(COMMANDS.ytResolve, { id: "abc" })).resolves.toBe("https://x");
    expect(mocks.invoke).toHaveBeenCalledWith("yt_resolve", { id: "abc" });
  });

  it("calls argument-less commands with the name alone", async () => {
    mocks.invoke.mockResolvedValue("http://127.0.0.1:1/t");

    await invokeCommand(COMMANDS.mediaServerBase);
    expect(mocks.invoke.mock.calls[0]).toEqual(["media_server_base"]);
  });

  it("turns the bridge failure outside Tauri into PlatformUnavailableError", async () => {
    // IS_TAURI is false under happy-dom; the real `invoke` rejects there.
    mocks.invoke.mockRejectedValue(new TypeError("window.__TAURI_INTERNALS__ is undefined"));

    await expect(invokeCommand(COMMANDS.checkUpdate)).rejects.toBeInstanceOf(PlatformUnavailableError);
  });
});
