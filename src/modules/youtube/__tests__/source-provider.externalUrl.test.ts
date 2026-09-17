import { describe, expect, it, vi } from "vitest";
import { TrackId } from "@/types/ids";
import { ytTrackId } from "@/types/track-ref";

vi.mock("@/modules/youtube/provider", () => ({
  youtubeProvider: { isAvailable: true },
}));

import { ytSourceProvider } from "../source-provider";

describe("ytSourceProvider", () => {
  it("opens the watch page for a yt track", () => {
    expect(ytSourceProvider.externalUrl?.({ id: ytTrackId("dQw4w9WgXcQ") }))
      .toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("has no page for a foreign id", () => {
    expect(ytSourceProvider.externalUrl?.({ id: TrackId("nd:s1") })).toBeNull();
  });

  it("searches on submit and asks for the long resolve deadline a cold yt-dlp run needs", () => {
    expect(ytSourceProvider.searchMode).toBe("submit");
    expect(ytSourceProvider.resolveTimeoutMs).toBeGreaterThan(15_000);
  });
});
