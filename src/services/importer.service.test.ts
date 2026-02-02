import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { okAsync, errAsync } from "neverthrow";
import { StorageError } from "@/db/errors/storage.errors";
import { hasNativeSupport } from "@/db/storage/IFileStorage";
import { ImportErrorCode, LibraryImporter } from "./importer.service";

const { mockStorage } = vi.hoisted(() => {
  return {
    mockStorage: {
      saveFile: vi.fn(),
      importFile: vi.fn(),
      readBytes: vi.fn(),
      warmup: vi.fn(),
    },
  };
});

vi.mock("../workers/meta.worker?worker", () => {
  return {
    default: class MockWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;

      postMessage(data: { fileId: string }) {
        setTimeout(() => {
          if (this.onmessage) {
            const responseData = {
              success: true,
              fileId: data.fileId,
              meta: {
                title: "Mock Title",
                artist: "Mock Artist",
                album: "Mock Album",
                duration: 120,
                format: { codec: "mp3", bitrate: 320 },
                pictureBlob: new Blob(["fake-image"], { type: "image/jpeg" }),
              },
            };
            this.onmessage({ data: responseData } as MessageEvent);
          }
        }, 10);
      }

      addEventListener(type: string, listener: (e: MessageEvent) => void) {
        if (type === "message") this.onmessage = listener;
      }

      terminate() {}
    },
  };
});

vi.mock("@/db/index", () => ({
  db: {
    transaction: vi.fn((...args: unknown[]) => {
      const callback = args[args.length - 1];
      if (typeof callback === "function") {
        return callback();
      }
      return Promise.resolve();
    }),
    artists: {
      get: vi.fn(),
      where: vi.fn(() => ({
        anyOf: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValue([]),
        })),
      })),
      bulkAdd: vi.fn(),
    },
    albums: {
      get: vi.fn(),
      where: vi.fn(() => ({
        anyOf: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValue([]),
        })),
      })),
      bulkAdd: vi.fn(),
    },
    tracks: {
      add: vi.fn(),
    },
  },
}));

vi.mock("@/db/storage", () => ({
  storageService: mockStorage,
}));

vi.mock("@/db/storage/IFileStorage", () => ({
  hasNativeSupport: vi.fn().mockReturnValue(false),
}));

vi.mock("@/helpers/environment/mimeSupport", () => ({
  isValidImportItem: vi.fn((name: string) => name.endsWith(".mp3")),
}));

describe("LibraryImporter Service", () => {
  let importer: LibraryImporter;

  beforeEach(() => {
    vi.clearAllMocks();
    importer = new LibraryImporter();

    mockStorage.saveFile.mockReturnValue(okAsync("saved/path.mp3"));
    mockStorage.importFile.mockReturnValue(okAsync("imported/path.mp3"));
    mockStorage.readBytes.mockReturnValue(okAsync(new Uint8Array([1, 2, 3])));
    mockStorage.warmup.mockResolvedValue(undefined);
  });

  afterEach(() => {
    importer.dispose();
  });

  describe("Web Import (importFiles)", () => {
    it("should successfully import valid files", async () => {
      const file = new File(["dummy content"], "test.mp3", { type: "audio/mpeg" });
      const result = await importer.importFiles([file]);

      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(0);

      expect(mockStorage.saveFile).toHaveBeenCalled();
      const saveCall = mockStorage.saveFile.mock.calls[0];
      expect(saveCall[0]).toContain("tracks/");
      expect(saveCall[1]).toBe(file);

      expect(mockStorage.saveFile).toHaveBeenCalledWith(
        expect.stringContaining("covers/art_"),
        expect.any(Blob),
      );

      expect(result.successful[0]).toMatchObject({
        title: "Mock Title",
        artist: "Mock Artist",
      });
    });

    it("should fail validation for unsupported extensions", async () => {
      const file = new File([""], "test.txt", { type: "text/plain" });
      const result = await importer.importFiles([file]);

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error.code).toBe(ImportErrorCode.UNSUPPORTED_FORMAT);
      expect(mockStorage.saveFile).not.toHaveBeenCalled();
    });

    it("should handle storage errors gracefully", async () => {
      mockStorage.saveFile.mockReturnValue(errAsync(StorageError.writeFailed("path", "error")));

      const file = new File([""], "test.mp3", { type: "audio/mpeg" });
      const result = await importer.importFiles([file]);

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error.code).toBe(ImportErrorCode.STORAGE_FAILED);
    });
  });

  describe("Native Import (importFromPaths)", () => {
    it("should fail if native support is missing", async () => {
      vi.mocked(hasNativeSupport).mockReturnValue(false);

      const result = await importer.importFromPaths(["/path/to/song.mp3"]);

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error.code).toBe(ImportErrorCode.NATIVE_IMPORT_UNAVAILABLE);
    });

    it("should successfully import using optimized flow (Native)", async () => {
      vi.mocked(hasNativeSupport).mockReturnValue(true);

      const paths = ["/abs/path/song.mp3"];
      const result = await importer.importFromPaths(paths);

      expect(result.successful).toHaveLength(1);

      expect(mockStorage.warmup).toHaveBeenCalled();
      expect(mockStorage.readBytes).toHaveBeenCalledWith(
        "/abs/path/song.mp3",
        expect.any(Number),
      );
      expect(mockStorage.importFile).toHaveBeenCalledWith(
        "/abs/path/song.mp3",
        expect.stringContaining("tracks/"),
      );
    });

    it("should handle native read errors", async () => {
      vi.mocked(hasNativeSupport).mockReturnValue(true);
      mockStorage.readBytes.mockReturnValue(errAsync(StorageError.readFailed("path", "error")));

      const result = await importer.importFromPaths(["/path/song.mp3"]);

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error.code).toBe(ImportErrorCode.READ_FAILED);
    });
  });
});
