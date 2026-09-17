import { Constants, type Innertube, type Misc } from "youtubei.js";
import { getLogger } from "@/lib/logger";
import { YtPlayabilityError } from "./errors";
import type { YtSession } from "./session";

//
// The stream half of the engine: turn a video id into a googlevideo URL
// the Rust `yt/` route can forward.
//
// The player request goes to the VISIONOS client — the one yt-dlp relies
// on. Measured 2026-09-17 (five tracks, incl. a 1 h mix): with the
// page-seeded visitor id it answers direct itag 140 URLs with no `n`
// parameter, no PO token needed, and googlevideo serves 206 on every range
// including an open one — where WEB_REMIX without a token stops after 1 MiB.
//

export interface ResolvedStream {
  url: string;
  /** Request headers the route must send; googlevideo binds the URL to the resolving client's User-Agent. */
  headers: [string, string][];
  /** Unix seconds from the URL's `expire=` parameter. */
  expiresAt: number | null;
  mimeType: string;
}

export type StreamRegistrar = (id: string, stream: ResolvedStream) => Promise<void>;

export interface StreamResolver {
  /** Resolves and registers the stream for `id`; a no-op while a recent registration is still fresh. */
  resolve: (id: string) => Promise<void>;
}

interface ResolverDeps {
  session: YtSession;
  register: StreamRegistrar;
  now?: () => number;
}

const STREAM_CLIENT = "VISIONOS";

/**
 * A registration is reused only briefly: the Rust side drops an entry
 * googlevideo refuses (IP change behind a proxy), and nothing tells this
 * side — so a replay soon after resolving skips the round-trip, anything
 * later resolves again.
 */
const REUSE_WINDOW_MS = 5 * 60_000;
/** Do not hand the route an entry about to expire mid-track. */
const EXPIRY_MARGIN_MS = 60_000;

type Format = Misc.Format;

const isAudio = (format: Format): boolean => format.mime_type.startsWith("audio/");

const bestByBitrate = (formats: Format[]): Format | undefined =>
  formats.reduce<Format | undefined>((best, format) => (!best || format.bitrate > best.bitrate ? format : best), undefined);

/** itag 140 (AAC, importable everywhere), else the best Opus, else any audio. */
export const chooseAudioFormat = (formats: Format[]): Format | undefined => {
  const audio = formats.filter(isAudio);
  const aac = audio.find(format => format.itag === 140);
  if (aac) return aac;
  return bestByBitrate(audio.filter(format => format.mime_type.startsWith("audio/webm"))) ?? bestByBitrate(audio);
};

export const expiresAtOf = (url: string): number | null => {
  const raw = new URL(url).searchParams.get("expire");
  const seconds = Number(raw);
  return raw && Number.isFinite(seconds) && seconds > 0 ? seconds : null;
};

const isBotCheck = (message: string): boolean => /not a bot|sign in to confirm/i.test(message);

export const createStreamResolver = (deps: ResolverDeps): StreamResolver => {
  const now = deps.now ?? Date.now;
  const registered = new Map<string, { at: number; expiresAt: number | null }>();

  const isFresh = (id: string): boolean => {
    const entry = registered.get(id);
    if (!entry) return false;
    if (now() - entry.at > REUSE_WINDOW_MS) return false;
    return entry.expiresAt === null || entry.expiresAt * 1000 - now() > EXPIRY_MARGIN_MS;
  };

  const resolveOnce = async (yt: Innertube, id: string): Promise<ResolvedStream> => {
    const info = await yt.getBasicInfo(id, { client: STREAM_CLIENT });
    const playability = info.playability_status;
    if (playability?.status !== "OK") {
      throw new YtPlayabilityError(playability?.status ?? "UNKNOWN", playability?.reason ?? "");
    }
    const format = chooseAudioFormat(info.streaming_data?.adaptive_formats ?? []);
    if (!format) throw new Error("player response carried no audio format");
    const url = await format.decipher(yt.session.player);
    return {
      url,
      headers: [["User-Agent", Constants.CLIENTS.VISIONOS.USER_AGENT]],
      expiresAt: expiresAtOf(url),
      mimeType: format.mime_type,
    };
  };

  const resolve = async (id: string): Promise<void> => {
    if (isFresh(id)) return;
    let stream: ResolvedStream;
    try {
      stream = await resolveOnce(await deps.session.get(), id);
    }
    catch (error) {
      if (!(error instanceof YtPlayabilityError && isBotCheck(error.message))) throw error;
      // The visitor id got flagged; a fresh page id is what unflags the request.
      getLogger().warn(`[YT] Bot check on ${id}, rebuilding the session once`);
      deps.session.invalidate();
      stream = await resolveOnce(await deps.session.get(), id);
    }
    await deps.register(id, stream);
    registered.set(id, { at: now(), expiresAt: stream.expiresAt });
  };

  return { resolve };
};
