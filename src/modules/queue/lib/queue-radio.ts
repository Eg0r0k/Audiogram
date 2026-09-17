import type { ResultAsync } from "neverthrow";
import type { SourceError, SourceTrackDTO } from "@/types/source-dto";

/**
 * An endless station the queue plays from: the source hands over a chain
 * of tracks, the queue asks for the next chain as it nears the tail, and
 * the session reports what happened to each track back to the source. The
 * session itself listens to the player for those outcomes — the queue only
 * starts it, tops it up and stops it.
 *
 * Not the autoplay hook: that one recommends from the local library by
 * exclusion, this one is the source's own feed with its own feedback loop.
 */
export interface RadioSession {
  readonly station: string;
  /** The first chain. Fails when the source cannot serve the station. */
  start(): ResultAsync<SourceTrackDTO[], SourceError>;
  /** The next chain, after what has played so far. */
  next(): ResultAsync<SourceTrackDTO[], SourceError>;
  /** Ends the session: no more chains, no more feedback. Idempotent. */
  stop(): void;
}

/** With this many entries left after the current one, the next chain is requested. */
export const RADIO_LOOKAHEAD = 2;
