import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import type { SourceProvider } from "@/modules/sources/types";
import type { SourceKind } from "@/types/track-ref";

vi.mock("../../service/searchIndex", () => ({
  initSearchIndex: vi.fn(async () => {}),
  rebuildSearchIndex: vi.fn(async () => {}),
  searchDocuments: vi.fn(async () => ({ results: [], total: 0, totalDuration: 0 })),
}));

import { sources } from "@/modules/sources/registry";
import { useSearch } from "../useSearch";

// Whether a source is searched as-you-type or on submit is the provider's
// call, not a kind check inside the search composable.

const stubProvider = (id: SourceKind, searchMode?: SourceProvider["searchMode"]): SourceProvider =>
  ({ id, searchMode, isAvailable: true } as unknown as SourceProvider);

describe("useSearch — search mode comes from the provider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sources.register(stubProvider("yt", "submit"));
    sources.register(stubProvider("nd"));
    const search = useSearch();
    search.clear();
    search.clearHistory();
    search.setSource("local");
  });

  afterEach(async () => {
    await vi.runAllTimersAsync();
    vi.useRealTimers();
  });

  it("auto-commits after the typing pause for a source that declares submit mode", async () => {
    const search = useSearch();
    search.setSource("yt");

    search.query.value = "lofi beats";
    await nextTick();
    expect(search.submittedQuery.value).toBe("");

    await vi.advanceTimersByTimeAsync(500);
    expect(search.submittedQuery.value).toBe("lofi beats");
  });

  it("never commits for a live source — its pane searches as you type", async () => {
    const search = useSearch();
    search.setSource("nd");

    search.query.value = "come together";
    await nextTick();
    await vi.advanceTimersByTimeAsync(500);

    expect(search.submittedQuery.value).toBe("");
    expect(search.isSubmitMode.value).toBe(false);
  });

  it("reports submit mode for the active source", () => {
    const search = useSearch();

    search.setSource("yt");
    expect(search.isSubmitMode.value).toBe(true);

    search.setSource("local");
    expect(search.isSubmitMode.value).toBe(false);
  });

  it("an explicit submit commits instantly and records history in submit mode", async () => {
    const search = useSearch();
    search.setSource("yt");

    search.query.value = "lofi beats";
    await nextTick();
    search.submitSearch();

    expect(search.submittedQuery.value).toBe("lofi beats");
    expect(search.recentQueries.value).toEqual(["lofi beats"]);
  });

  it("an explicit submit is a no-op for a live source", async () => {
    const search = useSearch();
    search.setSource("nd");

    search.query.value = "come together";
    await nextTick();
    search.submitSearch();

    expect(search.submittedQuery.value).toBe("");
    expect(search.recentQueries.value).toEqual([]);
  });

  it("switching to a submit-mode source with a pending query commits it right away", async () => {
    const search = useSearch();
    search.query.value = "pending";
    await nextTick();

    search.setSource("yt");

    expect(search.submittedQuery.value).toBe("pending");
  });
});
