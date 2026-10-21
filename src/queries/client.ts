import { QueryClient, MutationCache, QueryCache, hashKey } from "@tanstack/vue-query";
import { formatError, TERMINAL_SOURCE_ERRORS, toAppError } from "@/lib/errors";
import { getLogger } from "@/lib/logger";

const MAX_RETRIES = 2;

/** The library's own default, restated so a Retry-After can override it. */
const MAX_RETRY_DELAY_MS = 30_000;
const defaultRetryDelay = (failureCount: number): number =>
  Math.min(1000 * 2 ** failureCount, MAX_RETRY_DELAY_MS);

/** A source that named its own wait (429 Retry-After) is not asked again sooner. */
const retryDelay = (failureCount: number, error: unknown): number => {
  const appError = toAppError(error);
  return appError.domain === "source" && appError.retryAfterMs
    ? appError.retryAfterMs
    : defaultRetryDelay(failureCount);
};

// Only a source failure can be transient: a Dexie read answers the same way on every attempt.
const shouldRetry = (failureCount: number, error: unknown): boolean => {
  const appError = toAppError(error);
  return appError.domain === "source" && !TERMINAL_SOURCE_ERRORS.has(appError.kind) && failureCount < MAX_RETRIES;
};

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError(error, query) {
      getLogger().error(`[Query] ${query.queryHash} - ${formatError(error)}`);
    },
  }),
  mutationCache: new MutationCache({
    onError(error, _vars, _ctx, mutation) {
      const key = mutation.options.mutationKey;
      getLogger().error(`[Mutation] ${key ? hashKey(key) : "unknown"} - ${formatError(error)}`);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: shouldRetry,
      retryDelay,
      refetchOnWindowFocus: false,
      // Reads are Dexie, not the network: the library default ("online")
      // pauses every query while navigator.onLine is false. Remote sources
      // opt back in with REMOTE_QUERY_OPTIONS.
      networkMode: "always",
    },
  },
});
