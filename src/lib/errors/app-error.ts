import { ImportErrorCode, StorageErrorCode, type DbErrorCode } from "@/types/error-codes";
import type { SourceError, SourceErrorKind } from "@/types/source-dto";
import type { SourceKind } from "@/types/track-ref";
import type { UpdateErrorKind } from "@/types/update-error";
import { AppFailure } from "./app-failure";

export type NativeErrorKind = "INVALID_INPUT" | "NETWORK" | "IO" | "UNAVAILABLE" | "UNKNOWN";

export interface DbAppError { domain: "db"; code: DbErrorCode; message: string; cause?: unknown }
export interface StorageAppError { domain: "storage"; code: StorageErrorCode; message: string; path?: string; cause?: unknown }
export interface ImportAppError { domain: "import"; code: ImportErrorCode; message: string; fileName?: string; cause?: unknown }
export interface SourceAppError { domain: "source"; kind: SourceErrorKind; message: string; source?: SourceKind; retryAfterMs?: number }
export interface NativeAppError { domain: "native"; kind: NativeErrorKind; message: string; cause?: unknown }
export interface UpdateAppError { domain: "update"; kind: UpdateErrorKind; message: string }
export interface PlatformAppError { domain: "platform"; command?: string; message: string }
export interface CancelledAppError { domain: "cancelled"; message: string }
export interface UnknownAppError { domain: "unknown"; message: string; cause?: unknown }

export type AppError
  = | DbAppError
    | StorageAppError
    | ImportAppError
    | SourceAppError
    | NativeAppError
    | UpdateAppError
    | PlatformAppError
    | CancelledAppError
    | UnknownAppError;

export type AppErrorDomain = AppError["domain"];

export const errorMessage = (cause: unknown, fallback = "Unknown error"): string => {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === "string") return cause;
  return isRecord(cause) && typeof cause.message === "string" ? cause.message : fallback;
};

export const TERMINAL_SOURCE_ERRORS: ReadonlySet<SourceErrorKind> = new Set<SourceErrorKind>([
  "PARSE",
  "AUTH",
  "FORBIDDEN",
  "NOT_FOUND",
  "CANCELLED",
  "INVALID_INPUT",
]);

const SOURCE_ERROR_KINDS: ReadonlySet<string> = new Set(Object.keys({
  UNAVAILABLE: true,
  AUTH: true,
  FORBIDDEN: true,
  NETWORK: true,
  NOT_FOUND: true,
  RATE_LIMITED: true,
  PARSE: true,
  CANCELLED: true,
  INVALID_INPUT: true,
  UNKNOWN: true,
} satisfies Record<SourceErrorKind, true>));

const CODE_FIELDS: ReadonlyMap<string, "code" | "kind" | null> = new Map(Object.entries({
  db: "code",
  storage: "code",
  import: "code",
  source: "kind",
  native: "kind",
  update: "kind",
  platform: null,
  cancelled: null,
  unknown: null,
} satisfies Record<AppErrorDomain, "code" | "kind" | null>));

const FETCH_FAILURE = /failed to fetch|networkerror|load failed/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const messageOf = (error: Error): string => error.message || error.name;

export const isAppError = (value: unknown): value is AppError => {
  if (!isRecord(value) || typeof value.domain !== "string" || typeof value.message !== "string") return false;

  const field = CODE_FIELDS.get(value.domain);
  if (field === undefined) return false;
  return field === null || typeof value[field] === "string";
};

export const isSourceError = (value: unknown): value is SourceError =>
  isRecord(value)
  && typeof value.kind === "string"
  && SOURCE_ERROR_KINDS.has(value.kind)
  && typeof value.message === "string";

export const toAppError = (thrown: unknown): AppError => {
  if (thrown instanceof AppFailure) return thrown.error;
  if (isAppError(thrown)) return thrown;
  // A `domain` outside the nine marks a broken envelope, not a bare SourceError.
  if (isSourceError(thrown) && !("domain" in thrown)) return { domain: "source", ...thrown };
  if (thrown instanceof DOMException && thrown.name === "AbortError") {
    return { domain: "cancelled", message: messageOf(thrown) };
  }
  if (thrown instanceof TypeError && FETCH_FAILURE.test(thrown.message)) {
    return { domain: "native", kind: "NETWORK", message: thrown.message, cause: thrown };
  }
  if (thrown instanceof Error) return { domain: "unknown", message: messageOf(thrown), cause: thrown };
  if (typeof thrown === "string") return { domain: "unknown", message: thrown };
  return { domain: "unknown", message: "Unknown error" };
};

export const isCancelled = (error: AppError): boolean =>
  error.domain === "cancelled"
  || (error.domain === "source" && error.kind === "CANCELLED")
  || (error.domain === "import" && error.code === ImportErrorCode.CANCELLED);

export const isNotFound = (error: AppError): boolean =>
  (error.domain === "db" && error.code === "NOT_FOUND")
  || (error.domain === "storage" && error.code === StorageErrorCode.FILE_NOT_FOUND)
  || (error.domain === "source" && error.kind === "NOT_FOUND");

export const isRetryable = (error: AppError): boolean => {
  if (error.domain === "source") return !TERMINAL_SOURCE_ERRORS.has(error.kind);
  return (error.domain === "native" || error.domain === "update") && error.kind === "NETWORK";
};

const codeOf = (error: AppError): string | undefined => {
  switch (error.domain) {
    case "db":
    case "storage":
    case "import":
      return error.code;
    case "source":
    case "native":
    case "update":
      return error.kind;
    case "platform":
      return error.command;
    case "unknown":
      return error.cause instanceof Error ? error.cause.name : undefined;
    case "cancelled":
      return undefined;
  }
};

// A cause that repeats the message adds nothing; an Error one may still carry its own cause.
const causeOf = (error: AppError): unknown => {
  const cause = "cause" in error ? error.cause : undefined;
  if (cause instanceof Error && (cause.message === error.message || messageOf(cause) === error.message)) {
    return "cause" in cause ? cause.cause : undefined;
  }
  return errorMessage(cause) === error.message ? undefined : cause;
};

export const formatError = (thrown: unknown): string => {
  const error = toAppError(thrown);
  const code = codeOf(error);
  const head = code ? `${error.domain}/${code}: ${error.message}` : `${error.domain}: ${error.message}`;
  const cause = causeOf(error);
  return cause === undefined ? head : `${head} <- ${errorMessage(cause)}`;
};
