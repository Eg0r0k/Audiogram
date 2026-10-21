import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { DbError, toDbError } from "@/db/errors/db.errors";
import { StorageError, StorageErrorCode } from "@/db/errors/storage.errors";
import { ImportError, ImportErrorCode } from "@/services/types";
import * as codes from "@/types/error-codes";
import { AppFailure } from "../app-failure";

describe("AppFailure", () => {
  it("is an Error whose message is the envelope message", () => {
    const failure = new AppFailure({ domain: "native", kind: "IO", message: "disk" });
    expect(failure).toBeInstanceOf(Error);
    expect(failure.name).toBe("AppFailure");
    expect(failure.message).toBe("disk");
    expect(failure.error).toEqual({ domain: "native", kind: "IO", message: "disk" });
  });

  it("DbError, StorageError and ImportError are AppFailures and keep their fields", () => {
    const cause = new Error("inner");

    const db = new DbError("QUOTA", "full", cause);
    expect(db).toBeInstanceOf(AppFailure);
    expect(db).toBeInstanceOf(Error);
    expect(db.name).toBe("DbError");
    expect(db.code).toBe("QUOTA");
    expect(db.message).toBe("full");
    expect(db.cause).toBe(cause);
    expect(db.error).toEqual({ domain: "db", code: "QUOTA", message: "full", cause });

    const storage = new StorageError(StorageErrorCode.READ_FAILED, "Read failed: /a.mp3", "/a.mp3", cause);
    expect(storage).toBeInstanceOf(AppFailure);
    expect(storage.name).toBe("StorageError");
    expect(storage.code).toBe(StorageErrorCode.READ_FAILED);
    expect(storage.path).toBe("/a.mp3");
    expect(storage.cause).toBe(cause);
    expect(storage.error).toEqual({ domain: "storage", code: "READ_FAILED", message: "Read failed: /a.mp3", path: "/a.mp3", cause });

    const imported = new ImportError(ImportErrorCode.PARSE_FAILED, "Parse failed: a.mp3", "a.mp3", cause);
    expect(imported).toBeInstanceOf(AppFailure);
    expect(imported.name).toBe("ImportError");
    expect(imported.code).toBe(ImportErrorCode.PARSE_FAILED);
    expect(imported.fileName).toBe("a.mp3");
    expect(imported.cause).toBe(cause);
    expect(imported.error).toEqual({ domain: "import", code: "PARSE_FAILED", message: "Parse failed: a.mp3", fileName: "a.mp3", cause });
  });

  it("static factories still build the right code, path and fileName", () => {
    expect(StorageErrorCode).toBe(codes.StorageErrorCode);
    expect(ImportErrorCode).toBe(codes.ImportErrorCode);

    expect(StorageError.fileNotFound("/a")).toMatchObject({ code: "FILE_NOT_FOUND", path: "/a", message: "File not found: /a" });
    expect(StorageError.permissionDenied("/a")).toMatchObject({ code: "PERMISSION_DENIED", path: "/a" });
    expect(StorageError.invalidPath("/a")).toMatchObject({ code: "INVALID_PATH", path: "/a" });
    expect(StorageError.writeFailed("/a")).toMatchObject({ code: "WRITE_FAILED", path: "/a" });
    expect(StorageError.readFailed("/a")).toMatchObject({ code: "READ_FAILED", path: "/a" });
    expect(StorageError.deleteFailed("/a").error).toEqual({ domain: "storage", code: "DELETE_FAILED", message: "Delete failed: /a", path: "/a" });

    expect(ImportError.parseFailed("a.mp3")).toMatchObject({ code: "PARSE_FAILED", fileName: "a.mp3", message: "Parse failed: a.mp3" });
    expect(ImportError.storageFailed("a.mp3")).toMatchObject({ code: "STORAGE_FAILED", fileName: "a.mp3" });
    expect(ImportError.databaseFailed("a.mp3")).toMatchObject({ code: "DATABASE_FAILED", fileName: "a.mp3" });
    expect(ImportError.workerTimeout("a.mp3")).toMatchObject({ code: "WORKER_TIMEOUT", fileName: "a.mp3" });
    expect(ImportError.unsupportedFormat("a.xyz", "xyz")).toMatchObject({ code: "UNSUPPORTED_FORMAT", message: "Unsupported: xyz: a.xyz" });
    expect(ImportError.readFailed("a.mp3")).toMatchObject({ code: "READ_FAILED", fileName: "a.mp3" });
    expect(ImportError.nativeImportUnavailable("a.mp3")).toMatchObject({ code: "NATIVE_IMPORT_UNAVAILABLE", fileName: "a.mp3" });
    expect(ImportError.cancelled("a.mp3").error).toEqual({ domain: "import", code: "CANCELLED", message: "Import cancelled: a.mp3", fileName: "a.mp3" });
  });

  it("toDbError still passes a DbError through and maps Dexie names", () => {
    const existing = new DbError("QUOTA", "x");
    expect(toDbError(existing)).toBe(existing);

    expect(toDbError(new Dexie.VersionError("v")).code).toBe("VERSION");
    expect(toDbError(new Dexie.UpgradeError("u")).code).toBe("UPGRADE");
    expect(toDbError(new Dexie.DatabaseClosedError("c")).code).toBe("CLOSED");
    expect(toDbError(new Dexie.ConstraintError("k")).code).toBe("CONSTRAINT");
    expect(toDbError(new Dexie.BulkError("b", [])).code).toBe("CONSTRAINT");

    const inner = new Dexie.QuotaExceededError("full");
    const mapped = toDbError(new Dexie.AbortError("aborted", inner));
    expect(mapped).toBeInstanceOf(AppFailure);
    expect(mapped.error).toMatchObject({ domain: "db", code: "QUOTA", message: mapped.message });

    const original = new Error("boom");
    expect(toDbError(original).error).toEqual({ domain: "db", code: "UNKNOWN", message: "boom", cause: original });
  });
});
