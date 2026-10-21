export type DbErrorCode
  /** Installed database version is newer than the schema this build declares (app downgrade). */
  = | "VERSION"
  /** A `.upgrade()` handler threw; the database could not be migrated. */
    | "UPGRADE"
  /** Browser/WebView storage quota exhausted. */
    | "QUOTA"
  /** Connection closed (after `versionchange` from another instance). */
    | "CLOSED"
  /** Unique-key violation, including a `BulkError` from bulkAdd/bulkPut. */
    | "CONSTRAINT"
    | "NOT_FOUND"
    | "UNKNOWN";

export enum StorageErrorCode {
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  STORAGE_FULL = "STORAGE_FULL",
  INVALID_PATH = "INVALID_PATH",
  WRITE_FAILED = "WRITE_FAILED",
  READ_FAILED = "READ_FAILED",
  DELETE_FAILED = "DELETE_FAILED",
}

export enum ImportErrorCode {
  PARSE_FAILED = "PARSE_FAILED",
  STORAGE_FAILED = "STORAGE_FAILED",
  DATABASE_FAILED = "DATABASE_FAILED",
  WORKER_TIMEOUT = "WORKER_TIMEOUT",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT",
  NATIVE_IMPORT_UNAVAILABLE = "NATIVE_IMPORT_UNAVAILABLE",
  READ_FAILED = "READ_FAILED",
  CANCELLED = "CANCELLED",
}
