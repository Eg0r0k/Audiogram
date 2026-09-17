import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/plugin-http", () => ({ fetch: fetchMock }));

import { createYtFetch, DEFAULT_USER_AGENT } from "../transport";

const lastInit = () => fetchMock.mock.calls.at(-1)?.[1] as RequestInit & { proxy?: unknown };
const lastHeaders = () => new Headers(lastInit().headers);

describe("createYtFetch", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response("ok"));
  });

  it("forwards method, body and caller headers", async () => {
    const ytFetch = createYtFetch(() => null);

    await ytFetch("https://www.youtube.com/youtubei/v1/search", {
      method: "POST",
      body: "{}",
      headers: { "X-Goog-Visitor-Id": "v", "User-Agent": "ua" },
    });

    expect(fetchMock.mock.calls[0][0]).toBe("https://www.youtube.com/youtubei/v1/search");
    expect(lastInit().method).toBe("POST");
    expect(lastInit().body).toBe("{}");
    expect(lastHeaders().get("X-Goog-Visitor-Id")).toBe("v");
    expect(lastHeaders().get("User-Agent")).toBe("ua");
  });

  it("gives Innertube and player requests the youtube.com origin unless one was set", async () => {
    const ytFetch = createYtFetch(() => null);

    await ytFetch("https://www.youtube.com/s/player/x/base.js");
    expect(lastHeaders().get("Origin")).toBe("https://www.youtube.com");

    await ytFetch("https://jnn-pa.googleapis.com/x", { headers: { Origin: "https://music.youtube.com" } });
    expect(lastHeaders().get("Origin")).toBe("https://music.youtube.com");
  });

  it("sends an empty origin to googlevideo so the Rust side drops the header", async () => {
    const ytFetch = createYtFetch(() => null);

    await ytFetch("https://rr3---sn-x.googlevideo.com/videoplayback?x=1", { headers: { Origin: "https://www.youtube.com" } });

    expect(lastHeaders().get("Origin")).toBe("");
  });

  it("fills in a browser user agent only when the caller sent none", async () => {
    const ytFetch = createYtFetch(() => null);

    await ytFetch("https://www.youtube.com/");

    expect(lastHeaders().get("User-Agent")).toBe(DEFAULT_USER_AGENT);
  });

  it("passes the proxy option exactly when a proxy is configured", async () => {
    let proxy: string | null = null;
    const ytFetch = createYtFetch(() => proxy);

    await ytFetch("https://www.youtube.com/");
    expect(lastInit().proxy).toBeUndefined();

    proxy = "socks5://127.0.0.1:1080";
    await ytFetch("https://www.youtube.com/");
    expect(lastInit().proxy).toEqual({ all: "socks5://127.0.0.1:1080" });
  });

  it("accepts a Request input and reads its headers when init has none", async () => {
    const ytFetch = createYtFetch(() => null);
    const request = new Request("https://www.youtube.com/youtubei/v1/player", {
      method: "POST",
      headers: { "X-Youtube-Client-Name": "101" },
    });

    await ytFetch(request);

    expect(fetchMock.mock.calls[0][0]).toBe(request);
    expect(lastHeaders().get("X-Youtube-Client-Name")).toBe("101");
    expect(lastHeaders().get("Origin")).toBe("https://www.youtube.com");
  });
});
