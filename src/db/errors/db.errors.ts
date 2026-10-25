//
// Typed wrapper over Dexie/IndexedDB failures. Repositories return this in
// their `err` branch so callers can react to the few cases that matter
// (quota, version mismatch, upgrade failure) instead of pattern-matching on
// message strings.
//
import { err, ok, type Result } from "neverthrow";
import { AppFailure, errorMessage, type DbAppError } from "@/lib/errors";
import type { DbErrorCode } from "@/types/error-codes";

export type { DbErrorCode } from "@/types/error-codes";

export class DbError extends AppFailure<DbAppError> {
  constructor(
    public readonly code: DbErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super({ domain: "db", code, message, cause });
    this.name = "DbError";
  }
}

const NAME_TO_CODE: Partial<Record<string, DbErrorCode>> = {
  VersionError: "VERSION",
  UpgradeError: "UPGRADE",
  QuotaExceededError: "QUOTA",
  DatabaseClosedError: "CLOSED",
  ConstraintError: "CONSTRAINT",
  BulkError: "CONSTRAINT",
};

const errorName = (value: unknown): string =>
  typeof value === "object" && value !== null && "name" in value
    ? String((value as { name?: unknown }).name)
    : "";

// Dexie surfaces some native failures wrapped (an AbortError whose `inner`
// is the QuotaExceededError that actually aborted the transaction).
const innerOf = (value: unknown): unknown =>
  typeof value === "object" && value !== null && "inner" in value
    ? (value as { inner?: unknown }).inner
    : undefined;

export const toDbError = (error: unknown): DbError => {
  if (error instanceof DbError) return error;

  const code = NAME_TO_CODE[errorName(error)] ?? NAME_TO_CODE[errorName(innerOf(error))] ?? "UNKNOWN";
  const message = errorMessage(error);

  return new DbError(code, message, error);
};

export const attemptDb = async <T>(operation: () => Promise<T>): Promise<Result<T, DbError>> => {
  try {
    return ok(await operation());
  }
  catch (error) {
    return err(toDbError(error));
  }
};
