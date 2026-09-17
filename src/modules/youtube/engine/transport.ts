import { fetch as tauriFetch, type ClientOptions } from "@tauri-apps/plugin-http";

//
// The one fetch every YouTube request goes through: plugin-http (reqwest in
// Rust, so no CORS and the user's proxy applies), with the headers YouTube's
// hosts are picky about. Never logs — URLs carry visitor ids and signatures.
//

/** Sent when a caller gives none; youtubei.js and the page fetch set their own. */
export const DEFAULT_USER_AGENT
  = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

const YOUTUBE_ORIGIN = "https://www.youtube.com";

const isGoogleVideo = (host: string): boolean =>
  host === "googlevideo.com" || host.endsWith(".googlevideo.com");

const urlOf = (input: RequestInfo | URL): string => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
};

/**
 * Builds a `fetch` over plugin-http. Innertube and player-JS requests get
 * `Origin: https://www.youtube.com` unless the caller set one; googlevideo
 * gets no Origin at all (an empty value tells the Rust side to drop it).
 * `getProxyUrl` is read per call so a settings change applies to the next
 * request without rebuilding anything.
 */
export const createYtFetch = (getProxyUrl: () => string | null): typeof fetch =>
  async (input, init) => {
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const host = new URL(urlOf(input)).hostname;

    if (isGoogleVideo(host)) headers.set("Origin", "");
    else if (!headers.has("Origin")) headers.set("Origin", YOUTUBE_ORIGIN);
    if (!headers.has("User-Agent")) headers.set("User-Agent", DEFAULT_USER_AGENT);

    const proxy = getProxyUrl();
    const options: RequestInit & ClientOptions = { ...init, headers };
    if (proxy) options.proxy = { all: proxy };
    return tauriFetch(input, options);
  };
