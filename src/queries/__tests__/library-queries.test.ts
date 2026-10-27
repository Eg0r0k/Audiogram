import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/vue-query";
import {
  clearLibraryData,
  invalidateLibraryData,
} from "../library.queries";
import { queryKeys } from "../query-keys";
vi.mock("@/modules/covers/lib/cover-cache", () => ({
  coverCache: { invalidateAll: vi.fn(), invalidate: vi.fn(), set: vi.fn() },
}));
import { coverCache } from "@/modules/covers/lib/cover-cache";
vi.mock("../track.queries", () => ({ rebuildCounters: vi.fn() }));
import { rebuildCounters } from "../track.queries";

describe("library.queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("clearLibraryData", () => {
    const flush = async () => {
      for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0));
    };

    // The whole database was wiped, so no remote or stats answer is true any
    // more. A mounted one must not keep showing the old rows: its query is
    // reset and read again, not removed from under it.
    it("drops the remote and stats answers and re-reads the observed ones", async () => {
      const realClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const reads: number[] = [];
      const observer = new QueryObserver(realClient, {
        queryKey: queryKeys.source.artists("nd"),
        queryFn: async () => {
          reads.push(reads.length + 1);
          return reads.length;
        },
      });
      const unsubscribe = observer.subscribe(() => {});
      await flush();
      expect(observer.getCurrentResult().data).toBe(1);
      realClient.setQueryData(queryKeys.youtube.videoSearch("q"), []);
      realClient.setQueryData(queryKeys.stats.streaks(), { current: 3 });

      await clearLibraryData(realClient);
      await flush();

      expect(observer.getCurrentResult().data).toBe(2);
      expect(realClient.getQueryData(queryKeys.youtube.videoSearch("q"))).toBeUndefined();
      expect(realClient.getQueryData(queryKeys.stats.streaks())).toBeUndefined();
      expect(coverCache.invalidateAll).toHaveBeenCalled();
      expect(rebuildCounters).toHaveBeenCalledOnce();
      unsubscribe();
    });
  });

  describe("invalidateLibraryData", () => {
    it("resets the cover cache", () => {
      invalidateLibraryData();

      expect(coverCache.invalidateAll).toHaveBeenCalledOnce();
    });
  });
});
