import { QueryClient, MutationCache, QueryCache, hashKey } from "@tanstack/vue-query";
import { getLogger } from "@/lib/logger";
import { SourceQueryError } from "@/queries/shared";
import type { SourceErrorKind } from "@/types/source-dto";

const MAX_RETRIES = 2;

/**
 * Source errors that repeating the request cannot change: a malformed body, a
 * rejected credential, a missing resource, a deliberate abort. A retry there
 * only repeats the log line.
 */
const TERMINAL_SOURCE_ERRORS = new Set<SourceErrorKind>([
  "PARSE",
  "AUTH",
  "FORBIDDEN",
  "NOT_FOUND",
  "CANCELLED",
]);

/** The library's own default, restated so a Retry-After can override it. */
const MAX_RETRY_DELAY_MS = 30_000;
const defaultRetryDelay = (failureCount: number): number =>
  Math.min(1000 * 2 ** failureCount, MAX_RETRY_DELAY_MS);

/** A source that named its own wait (429 Retry-After) is not asked again sooner. */
const retryDelay = (failureCount: number, error: unknown): number =>
  (error instanceof SourceQueryError && error.retryAfterMs
    ? error.retryAfterMs
    : defaultRetryDelay(failureCount));

/**
 * Only a source error can be transient, and only the source boundary
 * (`unwrapSourceResult`) raises one. Everything else is Dexie, and a Dexie
 * read answers the same way on every attempt — "not found" or a full quota
 * would only reach the screen three seconds late.
 */
const isRetryableSourceError = (error: unknown): boolean =>
  error instanceof SourceQueryError && !TERMINAL_SOURCE_ERRORS.has(error.kind);

const shouldRetry = (failureCount: number, error: unknown): boolean =>
  isRetryableSourceError(error) && failureCount < MAX_RETRIES;

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError(error, query) {
      getLogger().error(`[Query] ${query.queryHash} — ${error.message}`);
    },
  }),
  mutationCache: new MutationCache({
    onError(error, _vars, _ctx, mutation) {
      const key = mutation.options.mutationKey;
      getLogger().error(`[Mutation] ${key ? hashKey(key) : "unknown"} — ${error.message}`);
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
