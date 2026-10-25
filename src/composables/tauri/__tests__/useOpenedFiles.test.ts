import { beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";

const listenMock = vi.hoisted(() => vi.fn());
const platformCapsMock = vi.hoisted(() => ({ hasFs: true }));

vi.mock("@/lib/environment/userAgent", () => ({
  IS_TAURI: true,
  IS_MOBILE: false,
  IS_WINDOWS: false,
}));
vi.mock("@/lib/environment/platformCaps", () => ({ platformCaps: platformCapsMock }));
vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: listenMock }));

import { useOpenedFiles, type OpenedFile } from "../useOpenedFiles";

type FilesOpenedHandler = (event: { payload: string[] }) => void;

const flush = async () => {
  await vi.dynamicImportSettled();
  await Promise.resolve();
};

const subscribe = async (onFiles: (files: OpenedFile[]) => void) => {
  const scope = effectScope();
  scope.run(() => useOpenedFiles(onFiles));
  await flush();
  return scope;
};

const emitOpenedFiles = (payload: string[]) => {
  const [name, handler] = listenMock.mock.calls[0] as [string, FilesOpenedHandler];
  expect(name).toBe("files-opened");
  handler({ payload });
};

describe("useOpenedFiles", () => {
  beforeEach(() => {
    listenMock.mockReset();
    listenMock.mockResolvedValue(vi.fn());
    platformCapsMock.hasFs = true;
  });

  it("passes the importable opened files with their names", async () => {
    const onFiles = vi.fn();
    await subscribe(onFiles);

    emitOpenedFiles([
      "C:\\Music\\Intro.mp3",
      "C:\\Docs\\notes.txt",
      "/home/user/music/Live Set.flac",
    ]);

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles).toHaveBeenCalledWith([
      { path: "C:\\Music\\Intro.mp3", name: "Intro.mp3" },
      { path: "/home/user/music/Live Set.flac", name: "Live Set.flac" },
    ]);
  });

  it("stays silent when no opened file is importable", async () => {
    const onFiles = vi.fn();
    await subscribe(onFiles);

    emitOpenedFiles(["C:\\Docs\\notes.txt", "/home/user/cover.jpg"]);
    emitOpenedFiles([]);

    expect(onFiles).not.toHaveBeenCalled();
  });

  it("does not subscribe without a file system", async () => {
    platformCapsMock.hasFs = false;

    await subscribe(vi.fn());

    expect(listenMock).not.toHaveBeenCalled();
  });

  it("unsubscribes when its scope is disposed", async () => {
    const stop = vi.fn();
    listenMock.mockResolvedValue(stop);

    const scope = await subscribe(vi.fn());
    expect(stop).not.toHaveBeenCalled();

    scope.stop();

    expect(stop).toHaveBeenCalledTimes(1);
  });
});
