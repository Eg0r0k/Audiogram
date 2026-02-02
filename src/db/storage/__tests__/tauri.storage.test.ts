import { describe, it, expect, vi, beforeEach } from "vitest";
import { TauriStorage } from "../tauri.storage";
import { StorageError } from "@/db/errors/storage.errors";

const mocks = vi.hoisted(() => ({
  writeFile: vi.fn(),
  readFile: vi.fn(),
  copyFile: vi.fn(),
  exists: vi.fn(),
  mkdir: vi.fn(),
  readDir: vi.fn(),
  remove: vi.fn(),
  open: vi.fn(),
  appDataDir: vi.fn(),
  convertFileSrc: vi.fn(),
  fileHandle: {
    read: vi.fn(),
    close: vi.fn(),
  },
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  writeFile: mocks.writeFile,
  readFile: mocks.readFile,
  copyFile: mocks.copyFile,
  exists: mocks.exists,
  mkdir: mocks.mkdir,
  readDir: mocks.readDir,
  remove: mocks.remove,
  open: mocks.open,
  BaseDirectory: { AppData: 1 },
}));

vi.mock("@tauri-apps/api/path", () => ({
  appDataDir: mocks.appDataDir,
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: mocks.convertFileSrc,
}));

describe("TauriStorage", () => {
  let storage: TauriStorage;
  const APP_DATA_PATH = "/usr/appdata";

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new TauriStorage();

    mocks.appDataDir.mockResolvedValue(APP_DATA_PATH);
    mocks.exists.mockResolvedValue(true);
    mocks.open.mockResolvedValue(mocks.fileHandle);
  });

  describe("warmup", () => {
    it("should create directories if they do not exist", async () => {
      mocks.exists.mockResolvedValue(false);

      await storage.warmup(["tracks", "covers"]);

      expect(mocks.mkdir).toHaveBeenCalledTimes(2);
      expect(mocks.mkdir).toHaveBeenCalledWith("tracks", expect.any(Object));
      expect(mocks.mkdir).toHaveBeenCalledWith("covers", expect.any(Object));
    });

    it("should not create directories if they exist", async () => {
      mocks.exists.mockResolvedValue(true);

      await storage.warmup(["tracks"]);

      expect(mocks.mkdir).not.toHaveBeenCalled();
    });
  });

  describe("saveFile", () => {
    it("should write Uint8Array to file system", async () => {
      const data = new Uint8Array([1, 2, 3]);
      const result = await storage.saveFile("tracks/1.mp3", data);

      expect(result.isOk()).toBe(true);
      expect(mocks.writeFile).toHaveBeenCalledWith(
        "tracks/1.mp3",
        data,
        expect.objectContaining({ baseDir: 1 }),
      );
    });

    it("should convert Blob to Uint8Array and write", async () => {
      const blob = new Blob(["test"]);
      const result = await storage.saveFile("tracks/blob.txt", blob);

      expect(result.isOk()).toBe(true);
      expect(mocks.writeFile).toHaveBeenCalledWith(
        "tracks/blob.txt",
        expect.any(Uint8Array),
        expect.any(Object),
      );
    });

    it("should handle write errors", async () => {
      mocks.writeFile.mockRejectedValue(new Error("Disk full"));

      const result = await storage.saveFile("tracks/fail.mp3", new Uint8Array([]));

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(StorageError);
    });
  });

  describe("importFile", () => {
    it("should copy file using absolute paths", async () => {
      const source = "/users/downloads/music.mp3";
      const target = "tracks/music.mp3";

      const result = await storage.importFile(source, target);

      expect(result.isOk()).toBe(true);
      expect(mocks.copyFile).toHaveBeenCalledWith(
        source,
        `${APP_DATA_PATH}/${target}`,
      );
    });
  });

  describe("readBytes", () => {
    it("should read partial content from file", async () => {
      mocks.fileHandle.read.mockImplementation(async (buffer: Uint8Array) => {
        buffer[0] = 10;
        buffer[1] = 20;
        return 2;
      });

      const result = await storage.readBytes("test.mp3", 512);

      expect(result.isOk()).toBe(true);
      expect(mocks.open).toHaveBeenCalledWith("test.mp3", { read: true });

      const data = result._unsafeUnwrap();
      expect(data.length).toBe(2);
      expect(data[0]).toBe(10);
      expect(mocks.fileHandle.close).toHaveBeenCalled();
    });

    it("should handle cases when file is smaller than buffer", async () => {
      mocks.fileHandle.read.mockResolvedValue(0);

      const result = await storage.readBytes("empty.mp3", 10);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().length).toBe(0);
    });

    it("should handle null return from read (fix check)", async () => {
      mocks.fileHandle.read.mockResolvedValue(null);

      const result = await storage.readBytes("empty.mp3", 10);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().length).toBe(0);
    });
  });

  describe("getAudioUrl", () => {
    it("should convert path to asset url", async () => {
      mocks.convertFileSrc.mockReturnValue("asset://localhost/usr/appdata/tracks/1.mp3");

      const result = await storage.getAudioUrl("tracks/1.mp3");

      expect(result.isOk()).toBe(true);
      expect(mocks.convertFileSrc).toHaveBeenCalledWith(`${APP_DATA_PATH}/tracks/1.mp3`);
      expect(result._unsafeUnwrap()).toBe("asset://localhost/usr/appdata/tracks/1.mp3");
    });
  });
});
