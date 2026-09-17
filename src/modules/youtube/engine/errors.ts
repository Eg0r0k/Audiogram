import type { YoutubeError, YoutubeErrorKind } from "../types";

/** A watch page whose playability status is not OK; the message is YouTube's own reason. */
export class YtPlayabilityError extends Error {
  constructor(public readonly status: string, reason: string) {
    super(reason || `playability status ${status}`);
    this.name = "YtPlayabilityError";
  }
}

/** Thrown by the engine for a continuation the registry no longer knows. */
export class YtContinuationExpiredError extends Error {
  constructor() {
    super("The search results expired; search again");
    this.name = "YtContinuationExpiredError";
  }
}

const isBotCheck = (message: string): boolean => /not a bot|sign in to confirm/i.test(message);

const playabilityKind = (error: YtPlayabilityError): YoutubeErrorKind => {
  if (isBotCheck(error.message)) return "UNKNOWN";
  if (error.status === "ERROR") return "NOT_FOUND";
  return "UNAVAILABLE_REGION";
};

/** `Request to … failed with status code 404` (youtubei.js's HTTPClient) → the code. */
const httpStatusOf = (message: string): number | null => {
  const match = /failed with status code (\d{3})/.exec(message);
  return match ? Number(match[1]) : null;
};

/**
 * Anything the engine rejects with, as the module's error vocabulary — same
 * kinds the Rust backend used to return, so `lib/errors.ts` and the
 * source-error mapping stay untouched. Messages never carry URLs.
 */
export const toYoutubeError = (error: unknown, fallback: YoutubeErrorKind): YoutubeError => {
  if (error instanceof YtPlayabilityError) {
    return { kind: playabilityKind(error), message: error.message };
  }
  if (error instanceof YtContinuationExpiredError) {
    return { kind: "NOT_FOUND", message: error.message };
  }
  const message = error instanceof Error ? error.message : String(error);
  const status = httpStatusOf(message);
  // youtubei.js answers an unknown id with a parse-level complaint ("No
  // contents found…") or YouTube's own "This video is unavailable".
  if (status === 404 || status === 400 || /unavailable|not found|no contents/i.test(message)) {
    return { kind: "NOT_FOUND", message };
  }
  if (status !== null && status >= 500) return { kind: "NETWORK", message };
  if (/error sending request|network|fetch failed|timed out|connection/i.test(message)) {
    return { kind: "NETWORK", message };
  }
  return { kind: fallback, message };
};
