import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock(import("@tauri-apps/api/core"), async (importOriginal) => ({ ...(await importOriginal()), invoke: mocks.invoke }));
vi.mock("../api/androidUpdateApi", () => ({ checkUpdateAndroid: vi.fn(), installUpdateAndroid: vi.fn() }));

import { checkUpdate, installUpdate } from "../api/updateApi";

describe("updateApi", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
  });

  it("keeps the kind of an update envelope", async () => {
    mocks.invoke.mockRejectedValueOnce({ domain: "update", kind: "INVALID_CHANNEL", message: "no such channel" });

    const result = await checkUpdate();

    expect(result._unsafeUnwrapErr()).toStrictEqual({ kind: "INVALID_CHANNEL", message: "no such channel" });
  });

  it("falls back to the given kind for a string rejection", async () => {
    mocks.invoke.mockRejectedValueOnce("updater plugin is not initialised");

    const result = await installUpdate();

    expect(result._unsafeUnwrapErr()).toStrictEqual({ kind: "INSTALL_FAILED", message: "updater plugin is not initialised" });
  });
});
