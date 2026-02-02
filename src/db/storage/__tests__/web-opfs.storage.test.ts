import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebOpfsStorage } from "../web-opfs.storage";
import { StorageError } from "@/db/errors/storage.errors";

type MockFileHandle = {
  kind: "file";
  name: string;
  createWritable: ReturnType<typeof vi.fn>;
  getFile: ReturnType<typeof vi.fn>;
};

type MockDirHandle = {
  kind: "directory";
  name: string;
  getDirectoryHandle: ReturnType<typeof vi.fn>;
  getFileHandle: ReturnType<typeof vi.fn>;
  removeEntry: ReturnType<typeof vi.fn>;
  values: () => AsyncGenerator<MockFileHandle | MockDirHandle, void, unknown>;
  _children: Map<string, MockFileHandle | MockDirHandle>;
};

const createMockDir = (name: string): MockDirHandle => {
  const children = new Map<string, MockFileHandle | MockDirHandle>();

  return {
    kind: "directory",
    name,
    _children: children,
    getDirectoryHandle: vi.fn(async (dirName: string, opts?: { create?: boolean }) => {
      if (children.has(dirName)) {
        const item = children.get(dirName);
        if (item?.kind !== "directory") throw new DOMException("TypeMismatch", "TypeMismatchError");
        return item;
      }
      if (opts?.create) {
        const newDir = createMockDir(dirName);
        children.set(dirName, newDir);
        return newDir;
      }
      throw new DOMException("Not found", "NotFoundError");
    }),
    getFileHandle: vi.fn(async (fileName: string, opts?: { create?: boolean }) => {
      if (children.has(fileName)) {
        const item = children.get(fileName);
        if (item?.kind !== "file") throw new DOMException("TypeMismatch", "TypeMismatchError");
        return item;
      }
      if (opts?.create) {
        const newFile = createMockFile(fileName);
        children.set(fileName, newFile);
        return newFile;
      }
      throw new DOMException("Not found", "NotFoundError");
    }),
    removeEntry: vi.fn(async (name: string) => {
      if (!children.has(name)) throw new DOMException("Not found", "NotFoundError");
      children.delete(name);
    }),
    values: async function* () {
      for (const value of children.values()) {
        yield value;
      }
    },
  };
};

const createMockFile = (name: string): MockFileHandle => ({
  kind: "file",
  name,
  createWritable: vi.fn(async () => ({
    write: vi.fn(),
    close: vi.fn(),
    abort: vi.fn(),
  })),
  getFile: vi.fn(async () => new Blob(["mock-content"])),
});

describe("WebOpfsStorage", () => {
  let storage: WebOpfsStorage;
  let rootHandle: MockDirHandle;

  beforeEach(() => {
    vi.restoreAllMocks();

    rootHandle = createMockDir("root");

    const mockStorageManager = {
      getDirectory: vi.fn(async () => rootHandle),
    };
    vi.stubGlobal("navigator", { storage: mockStorageManager });

    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock-url"),
      revokeObjectURL: vi.fn(),
    });

    storage = new WebOpfsStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("saveFile", () => {
    it("should create directories recursively and write file", async () => {
      const data = new Blob(["content"]);
      const result = await storage.saveFile("tracks/album1/song.mp3", data);

      expect(result.isOk()).toBe(true);

      const tracksDir = rootHandle._children.get("tracks") as MockDirHandle;
      expect(tracksDir).toBeDefined();
      expect(tracksDir.kind).toBe("directory");

      const albumDir = tracksDir._children.get("album1") as MockDirHandle;
      expect(albumDir).toBeDefined();

      const songFile = albumDir._children.get("song.mp3") as MockFileHandle;
      expect(songFile).toBeDefined();
      expect(songFile.kind).toBe("file");

      expect(songFile.createWritable).toHaveBeenCalled();
    });

    it("should return error if passing string data", async () => {
      // @ts-expect-error Testing runtime check
      const result = await storage.saveFile("test.txt", "string data");
      expect(result.isErr()).toBe(true);
    });
  });

  describe("getFile", () => {
    it("should retrieve existing file", async () => {
      const dir = createMockDir("folder");
      const file = createMockFile("test.txt");
      rootHandle._children.set("folder", dir);
      dir._children.set("test.txt", file);

      const result = await storage.getFile("folder/test.txt");

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBeInstanceOf(Blob);
      expect(file.getFile).toHaveBeenCalled();
    });

    it("should return NOT_FOUND error if file missing", async () => {
      const result = await storage.getFile("missing.txt");

      expect(result.isErr()).toBe(true);
      const err = result._unsafeUnwrapErr();
      expect(err).toBeInstanceOf(StorageError);
    });
  });

  describe("listFiles", () => {
    it("should list only files in directory", async () => {
      // Structure:
      // root/
      //   music/
      //     song1.mp3
      //     song2.mp3
      //     subfolder/ (should be ignored by implementation logic provided)

      const musicDir = createMockDir("music");
      rootHandle._children.set("music", musicDir);

      musicDir._children.set("song1.mp3", createMockFile("song1.mp3"));
      musicDir._children.set("song2.mp3", createMockFile("song2.mp3"));
      musicDir._children.set("subfolder", createMockDir("subfolder"));

      const result = await storage.listFiles("music");

      expect(result.isOk()).toBe(true);
      const files = result._unsafeUnwrap();

      expect(files).toHaveLength(2);
      expect(files).toContain("music/song1.mp3");
      expect(files).toContain("music/song2.mp3");
      expect(files).not.toContain("music/subfolder");
    });

    it("should return empty list if folder not found (handled by orElse)", async () => {
      const result = await storage.listFiles("non-existent");

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual([]);
    });
  });

  describe("deleteFile", () => {
    it("should delete existing file", async () => {
      const file = createMockFile("del.txt");
      rootHandle._children.set("del.txt", file);

      const result = await storage.deleteFile("del.txt");

      expect(result.isOk()).toBe(true);
      expect(rootHandle.removeEntry).toHaveBeenCalledWith("del.txt");
      expect(rootHandle._children.has("del.txt")).toBe(false);
    });

    it("should not fail if file doesn't exist (idempotent)", async () => {
      const result = await storage.deleteFile("ghost.txt");

      expect(result.isOk()).toBe(true);

      expect(rootHandle.removeEntry).toHaveBeenCalledWith("ghost.txt");
    });
  });
});
