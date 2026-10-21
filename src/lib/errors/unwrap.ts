import { getLogger } from "@/lib/logger";
import type { Result } from "neverthrow";
import { formatError, toAppError } from "./app-error";
import { AppFailure } from "./app-failure";

export const unwrapResult = async <T>(
  promise: Promise<Result<T, unknown>>,
): Promise<T> => {
  const result = await promise;

  if (result.isErr()) {
    getLogger().error(`[DB] ${formatError(result.error)}`);
    throw result.error instanceof AppFailure ? result.error : new AppFailure(toAppError(result.error));
  }

  return result.value;
};
