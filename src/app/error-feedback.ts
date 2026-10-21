import type { App } from "vue";
import { i18n } from "@/app/i18n";
import { toaster } from "@/app/toaster";
import { type AppError, type NativeErrorKind, formatError, isCancelled, isNotFound, toAppError } from "@/lib/errors";
import { getLogger } from "@/lib/logger";
import { type DbErrorCode, ImportErrorCode, StorageErrorCode } from "@/types/error-codes";
import type { SourceErrorKind } from "@/types/source-dto";

export type ErrorHint
  = | "network"
    | "unavailable"
    | "signIn"
    | "noAccess"
    | "notFound"
    | "slowDown"
    | "badResponse"
    | "storageFull"
    | "fileMissing"
    | "filePermission"
    | "desktopOnly"
    | "none";

export interface ReportErrorOptions {
  title: string;
  scope: string;
  id?: string;
  retry?: () => void;
}

const SOURCE_HINTS: Partial<Record<SourceErrorKind, ErrorHint>> = {
  NETWORK: "network",
  UNAVAILABLE: "unavailable",
  AUTH: "signIn",
  FORBIDDEN: "noAccess",
  NOT_FOUND: "notFound",
  RATE_LIMITED: "slowDown",
  PARSE: "badResponse",
  INVALID_INPUT: "badResponse",
};

const NATIVE_HINTS: Partial<Record<NativeErrorKind, ErrorHint>> = {
  NETWORK: "network",
  UNAVAILABLE: "unavailable",
  INVALID_INPUT: "badResponse",
};

const DB_HINTS: Partial<Record<DbErrorCode, ErrorHint>> = {
  NOT_FOUND: "notFound",
  QUOTA: "storageFull",
};

const STORAGE_HINTS: Partial<Record<StorageErrorCode, ErrorHint>> = {
  [StorageErrorCode.STORAGE_FULL]: "storageFull",
  [StorageErrorCode.FILE_NOT_FOUND]: "fileMissing",
  [StorageErrorCode.PERMISSION_DENIED]: "filePermission",
};

export const hintOf = (error: AppError): ErrorHint => {
  switch (error.domain) {
    case "source":
      return SOURCE_HINTS[error.kind] ?? "none";
    case "native":
      return NATIVE_HINTS[error.kind] ?? "none";
    case "update":
      return error.kind === "NETWORK" ? "network" : "none";
    case "db":
      return DB_HINTS[error.code] ?? "none";
    case "storage":
      return STORAGE_HINTS[error.code] ?? "none";
    case "import":
      return error.code === ImportErrorCode.READ_FAILED ? "fileMissing" : "none";
    case "platform":
      return "desktopOnly";
    case "cancelled":
    case "unknown":
      return "none";
  }
};

export const describeError = (error: AppError): string | undefined => {
  const hint = hintOf(error);
  return hint === "none" ? undefined : i18n.global.t(`errors.hint.${hint}`);
};

export const loadErrorText = (thrown: unknown): string => {
  const error = toAppError(thrown);
  if (isNotFound(error)) return i18n.global.t("errors.notFound");

  const failed = i18n.global.t("errors.loadFailed");
  const hint = describeError(error);
  return hint === undefined ? failed : `${failed}. ${hint}`;
};

export const reportError = (thrown: unknown, { title, scope, id, retry }: ReportErrorOptions): AppError | null => {
  const error = toAppError(thrown);
  if (isCancelled(error)) {
    getLogger().debug(`[${scope}] ${title}: cancelled`);
    return null;
  }

  getLogger().error(`[${scope}] ${title}: ${formatError(error)}`);
  const description = describeError(error);
  toaster.add({
    ...(id === undefined ? {} : { id }),
    title,
    ...(description === undefined ? {} : { description }),
    color: "destructive",
    // Wrapped so a retry like `refetch` never receives the click event as its options.
    ...(retry ? { actions: [{ label: i18n.global.t("common.retry"), onClick: () => retry() }] } : {}),
  });
  return error;
};

export const installGlobalErrorHandlers = (app: App, target: Window = window): void => {
  app.config.errorHandler = (err, _instance, info) => {
    getLogger().error(`[Vue] ${info}: ${formatError(err)}`);
    // An installed errorHandler silences Vue's own console output; in dev the stack must stay visible.
    if (import.meta.env.DEV) console.error(err);
  };
  target.addEventListener("unhandledrejection", (event) => {
    getLogger().error(`[Unhandled] ${formatError(event.reason)}`);
    if (import.meta.env.DEV) console.error(event.reason);
  });
};
