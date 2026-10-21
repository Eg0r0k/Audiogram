import { toAppError } from "@/lib/errors";
import type { SourceError } from "@/types/source-dto";

// The SourceProvider contract keeps SourceError; this is the one translator from the envelope.
export const asSourceError = (thrown: unknown): SourceError => {
  const error = toAppError(thrown);
  switch (error.domain) {
    case "source":
      return error.retryAfterMs === undefined
        ? { kind: error.kind, message: error.message }
        : { kind: error.kind, message: error.message, retryAfterMs: error.retryAfterMs };
    case "platform":
      return { kind: "UNAVAILABLE", message: error.message };
    case "cancelled":
      return { kind: "CANCELLED", message: error.message };
    default:
      return { kind: "UNKNOWN", message: error.message };
  }
};
