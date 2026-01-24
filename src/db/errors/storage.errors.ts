export enum StorageErrorCode {
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  STORAGE_FULL = "STORAGE_FULL",
  INVALID_PATH = "INVALID_PATH",
  WRITE_FAILED = "WRITE_FAILED",
  READ_FAILED = "READ_FAILED",
  DELETE_FAILED = "DELETE_FAILED",
}

export class StorageError extends Error {
  constructor(
    public readonly code: StorageErrorCode,
    message: string,
    public readonly path?: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StorageError";
  }

  static fileNotFound(path: string, cause?: unknown) {
    return new StorageError(StorageErrorCode.FILE_NOT_FOUND, `File not found: ${path}`, path, cause);
  }

  static permissionDenied(path: string, cause?: unknown) {
    return new StorageError(StorageErrorCode.PERMISSION_DENIED, `Permission denied: ${path}`, path, cause);
  }

  static invalidPath(path: string) {
    return new StorageError(StorageErrorCode.INVALID_PATH, `Invalid path: ${path}`, path);
  }

  static writeFailed(path: string, cause?: unknown) {
    return new StorageError(StorageErrorCode.WRITE_FAILED, `Write failed: ${path}`, path, cause);
  }

  static readFailed(path: string, cause?: unknown) {
    return new StorageError(StorageErrorCode.READ_FAILED, `Read failed: ${path}`, path, cause);
  }

  static deleteFailed(path: string, cause?: unknown) {
    return new StorageError(StorageErrorCode.DELETE_FAILED, `Delete failed: ${path}`, path, cause);
  }
}
