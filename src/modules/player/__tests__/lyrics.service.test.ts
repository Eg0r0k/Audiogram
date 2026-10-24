import { err, ok } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchLrcLibLyrics } from "../service/lyrics.service";

interface LrclibEntry {
  syncedLyrics: string | null;
  plainLyrics: string | null;
  artistName: string;
}

const entry = (overrides: Partial<LrclibEntry> = {}): LrclibEntry => ({
  syncedLyrics: null,
  plainLyrics: null,
  artistName: "Artist",
  ...overrides,
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const fetchMock = vi.fn<typeof fetch>();

const answerWith = (routes: { exact?: Response | LrclibEntry; search?: LrclibEntry[] }) => {
  fetchMock.mockImplementation(async (input) => {
    const url = input as string;
    if (url.includes("/api/get?")) {
      const exact = routes.exact ?? json({ message: "not found" }, 404);
      return exact instanceof Response ? exact : json(exact);
    }
    return json(routes.search ?? []);
  });
};

const searchRequests = () => fetchMock.mock.calls.filter(([input]) => (input as string).includes("/api/search?"));

describe("fetchLrcLibLyrics", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers synced lyrics from the exact match", async () => {
    answerWith({ exact: entry({ syncedLyrics: "[00:01.00]Hello", plainLyrics: "Hello" }) });

    const result = await fetchLrcLibLyrics("Song", "Artist");

    expect(result).toEqual(ok({
      raw: "[00:01.00]Hello",
      lyrics: { kind: "synced", lines: [{ time: 1, text: "Hello" }] },
    }));
    expect(searchRequests()).toHaveLength(0);

    answerWith({
      exact: entry({ plainLyrics: "Plain hello" }),
      search: [entry({ syncedLyrics: "[00:02.00]Synced hello" })],
    });

    const fromSearch = await fetchLrcLibLyrics("Song", "Artist");

    expect(fromSearch).toEqual(ok({
      raw: "[00:02.00]Synced hello",
      lyrics: { kind: "synced", lines: [{ time: 2, text: "Synced hello" }] },
    }));
  });

  it("falls back to plain lyrics when LRCLIB has no synced version", async () => {
    answerWith({
      exact: entry({ plainLyrics: "Hello\nWorld" }),
      search: [
        entry({ plainLyrics: "Search plain" }),
        entry({ syncedLyrics: "[00:01.00]Someone else", artistName: "Other Band" }),
      ],
    });

    expect(await fetchLrcLibLyrics("Song", "Artist")).toEqual(ok({
      raw: "Hello\nWorld",
      lyrics: { kind: "plain", lines: ["Hello", "World"] },
    }));

    answerWith({ search: [entry({ plainLyrics: "Only\n\nin search" })] });

    expect(await fetchLrcLibLyrics("Song", "Artist")).toEqual(ok({
      raw: "Only\n\nin search",
      lyrics: { kind: "plain", lines: ["Only", "", "in search"] },
    }));
  });

  it("reports NOT_FOUND when LRCLIB has neither", async () => {
    answerWith({ search: [] });

    expect(await fetchLrcLibLyrics("Song", "Artist")).toEqual(err({ type: "NOT_FOUND" }));

    answerWith({ exact: entry(), search: [entry({ plainLyrics: "  \n " })] });

    expect(await fetchLrcLibLyrics("Song", "Artist")).toEqual(err({ type: "NOT_FOUND" }));
  });

  it("reports NETWORK on a failed request", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    expect(await fetchLrcLibLyrics("Song", "Artist")).toEqual(err({ type: "NETWORK", cause: expect.any(TypeError) }));

    answerWith({ exact: json({ message: "boom" }, 500), search: [] });

    expect(await fetchLrcLibLyrics("Song", "Artist")).toEqual(err({ type: "NETWORK", cause: expect.anything() }));
  });
});
