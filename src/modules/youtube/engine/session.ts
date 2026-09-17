import { Innertube, UniversalCache } from "youtubei.js";
import { getLogger } from "@/lib/logger";
import { installEvaluator } from "./evaluator";
import { DEFAULT_USER_AGENT } from "./transport";

//
// One Innertube session per proxy configuration, built on first use.
//
// The session is seeded with a visitor id taken from a real YouTube page.
// Measured 2026-09-17: the no-token VISIONOS player request (the one yt-dlp
// relies on for full-file streams) answers "Sign in to confirm you're not a
// bot" with a locally generated or sw.js_data visitor id, and OK with the
// page's VISITOR_DATA — the same request, same proxy, same minute.
//

export interface YtSession {
  /** The current session; built (or rebuilt after a proxy change / invalidate) on demand. */
  get: () => Promise<Innertube>;
  /** Drops the session so the next `get` starts over with a fresh visitor id. */
  invalidate: () => void;
}

type FetchFn = typeof globalThis.fetch;

interface SessionDeps {
  fetch: FetchFn;
  proxyUrl: () => string | null;
  fetchVisitorData?: (fetchFn: FetchFn) => Promise<string | null>;
}

const VISITOR_PAGE = "https://www.youtube.com/?hl=en";

/**
 * Loads the YouTube home page and pulls its `VISITOR_DATA`. The SOCS cookie
 * skips the consent interstitial EU exits get. Failures return null: search
 * still works on a local session, only no-token streams may then be refused.
 */
export const fetchPageVisitorData = async (fetchFn: FetchFn): Promise<string | null> => {
  const response = await fetchFn(VISITOR_PAGE, {
    headers: {
      "User-Agent": DEFAULT_USER_AGENT,
      "Accept": "text/html",
      "Accept-Language": "en-us,en;q=0.5",
      "Cookie": "SOCS=CAI",
    },
  });
  if (!response.ok) return null;
  const html = await response.text();
  return /"VISITOR_DATA":"([^"]+)"/.exec(html)?.[1] ?? null;
};

export const createYtSession = (deps: SessionDeps): YtSession => {
  const fetchVisitorData = deps.fetchVisitorData ?? fetchPageVisitorData;
  let current: Promise<Innertube> | null = null;
  let builtFor: string | null = null;

  const build = async (): Promise<Innertube> => {
    installEvaluator();
    const visitorData = await fetchVisitorData(deps.fetch).catch((error: unknown) => {
      getLogger().warn(`[YT] Visitor id lookup failed, using a local session: ${String(error)}`);
      return null;
    });
    return Innertube.create({
      fetch: deps.fetch,
      cache: new UniversalCache(false),
      lang: "en",
      retrieve_player: true,
      generate_session_locally: true,
      enable_session_cache: false,
      visitor_data: visitorData ?? undefined,
    });
  };

  return {
    get: () => {
      const proxy = deps.proxyUrl();
      if (current && builtFor === proxy) return current;
      builtFor = proxy;
      const building = build();
      current = building;
      building.catch(() => {
        if (current === building) current = null;
      });
      return building;
    },
    invalidate: () => {
      current = null;
    },
  };
};
