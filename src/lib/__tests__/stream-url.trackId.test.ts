import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/environment/userAgent", () => ({ IS_TAURI: true, IS_MOBILE: false, IS_WINDOWS: false }));

import { trackIdFromStreamUrl } from "../stream-url";

describe("trackIdFromStreamUrl", () => {
  it("rebuilds the branded track id behind a proxied remote stream", () => {
    expect(trackIdFromStreamUrl("http://127.0.0.1:4321/tok/yt/dQw4w9WgXcQ")).toBe("yt:dQw4w9WgXcQ");
    expect(trackIdFromStreamUrl("http://127.0.0.1:9/other-token/nd/song/s1")).toBe("nd:s1");
  });

  it("decodes the id the URL builder encoded", () => {
    expect(trackIdFromStreamUrl("http://127.0.0.1:4321/tok/nd/song/a%3Ab")).toBe("nd:a:b");
  });

  it("names no track for local files, covers and foreign URLs", () => {
    expect(trackIdFromStreamUrl("http://127.0.0.1:4321/tok/local/C%3A%2Fmusic%2Fa.mp3")).toBeNull();
    expect(trackIdFromStreamUrl("http://127.0.0.1:4321/tok/nd/cover/c1?size=300")).toBeNull();
    expect(trackIdFromStreamUrl("http://127.0.0.1:4321/tok/ytimg/https%3A%2F%2Fi.ytimg.com%2Fx.jpg")).toBeNull();
    expect(trackIdFromStreamUrl("https://radio.example/live.m3u8")).toBeNull();
    expect(trackIdFromStreamUrl(null)).toBeNull();
  });
});
