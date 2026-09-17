import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

vi.mock("../../service/searchIndex", () => ({
  initSearchIndex: vi.fn(async () => {}),
  rebuildSearchIndex: vi.fn(async () => {}),
  searchDocuments: vi.fn(async () => ({ results: [], total: 0, totalDuration: 0 })),
}));

import { sources } from "@/modules/sources/registry";
import type { SourceProvider } from "@/modules/sources/types";
import { useSearch } from "../useSearch";

// YT search auto-commits after a typing pause; only explicit submits write
// the recent-queries history.

describe("useSearch вЂ” debounced YouTube auto-commit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Submit mode is the provider's declaration; main.ts registers the real one.
    sources.register({ id: "yt", searchMode: "submit", isAvailable: true } as unknown as SourceProvider);
    const search = useSearch();
    search.clear();
    search.clearHistory();
    search.setSource("local");
  });

  afterEach(async () => {
    await vi.runAllTimersAsync();
    vi.useRealTimers();
  });

  it("commits the query after the debounce pause without Enter", async () => {
    const search = useSearch();
    search.setSource("yt");

    search.query.value = "lofi beats";
    await nextTick();
    expect(search.submittedQuery.value).toBe("");

    await vi.advanceTimersByTimeAsync(500);
    expect(search.submittedQuery.value).toBe("lofi beats");
    // Auto-commits never write history вЂ” only explicit submits do.
    expect(search.recentQueries.value).toEqual([]);
  });

  it("only the last value within the pause is committed", async () => {
    const search = useSearch();
    search.setSource("yt");

    search.query.value = "lo";
    await nextTick();
    await vi.advanceTimersByTimeAsync(100);
    search.query.value = "lofi";
    await nextTick();
    await vi.advanceTimersByTimeAsync(100);
    search.query.value = "lofi beats";
    await nextTick();
    await vi.advanceTimersByTimeAsync(500);

    expect(search.submittedQuery.value).toBe("lofi beats");
  });

  it("clearing the query resets the committed one immediately", async () => {
    const search = useSearch();
    search.setSource("yt");

    search.query.value = "lofi";
    await nextTick();
    await vi.advanceTimersByTimeAsync(500);
    expect(search.submittedQuery.value).toBe("lofi");

    search.query.value = "   ";
    await nextTick();
    expect(search.submittedQuery.value).toBe("");
  });

  it("does not auto-commit while another source is active", async () => {
    const search = useSearch();
    search.setSource("local");

    search.query.value = "local song";
    await nextTick();
    await vi.advanceTimersByTimeAsync(500);

    expect(search.submittedQuery.value).toBe("");
  });

  it("explicit submit still commits instantly and records history", async () => {
    const search = useSearch();
    search.setSource("yt");

    search.query.value = "lofi beats";
    await nextTick();
    search.submitSearch();

    expect(search.submittedQuery.value).toBe("lofi beats");
    expect(search.recentQueries.value).toEqual(["lofi beats"]);
  });
});
