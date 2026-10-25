import type { Result } from "neverthrow";

export const valueOrThrow = <T, E extends Error>(result: Result<T, E>): T => {
  if (result.isErr()) throw result.error;
  return result.value;
};
