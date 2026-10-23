import { describe, expect, it } from "vitest";
import { ymCoverHttpsUrl } from "../lib/cover";

describe("ymCoverHttpsUrl", () => {
  it("builds https urls for allowed hosts at a served rendition", () => {
    expect(ymCoverHttpsUrl("avatars.yandex.net/get-music-content/95061/4f3808a0.a.5307396-3/%%", 226))
      .toBe("https://avatars.yandex.net/get-music-content/95061/4f3808a0.a.5307396-3/300x300");
    expect(ymCoverHttpsUrl("avatars.mds.yandex.net/get-music-content/1/x/%%"))
      .toBe("https://avatars.mds.yandex.net/get-music-content/1/x/300x300");
    // Playlist covers carry a cache-busting query after the placeholder.
    expect(ymCoverHttpsUrl("avatars.yandex.net/get-music-user-playlist/10311229/s9xdf1jvxpHCJj/%%?1709726510822", 1000))
      .toBe("https://avatars.yandex.net/get-music-user-playlist/10311229/s9xdf1jvxpHCJj/1000x1000?1709726510822");
    expect(ymCoverHttpsUrl("avatars.yandex.net/x/%%", 64)).toBe("https://avatars.yandex.net/x/100x100");
  });

  it("refuses other hosts, schemes, missing placeholders and oversized requests", () => {
    expect(ymCoverHttpsUrl("evil.example/avatars.yandex.net/%%", 300)).toBe("");
    expect(ymCoverHttpsUrl("https://avatars.yandex.net/x/%%", 300)).toBe("");
    expect(ymCoverHttpsUrl("avatars.yandex.net.evil.example/x/%%", 300)).toBe("");
    expect(ymCoverHttpsUrl("avatars.yandex.net/x/300x300", 300)).toBe("");
    expect(ymCoverHttpsUrl("avatars.yandex.net", 300)).toBe("");
    expect(ymCoverHttpsUrl("avatars.yandex.net/x/%%", 4000)).toBe("");
  });
});
