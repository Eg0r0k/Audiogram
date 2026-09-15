import { describe, expect, it } from "vitest";
import { InfiniteQueryObserver, QueryClient, QueryObserver } from "@tanstack/vue-query";
import { settleLibraryReads } from "../cache";
import { queryKeys } from "../query-keys";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

const until = async (condition: () => boolean) => {
  for (let i = 0; i < 50 && !condition(); i++) await tick();
  expect(condition()).toBe(true);
};

// A read that started before a write answers with the rows as they were.
// Left alone it lands after the point-sync and puts them back; a key the
// mutation does not invalidate then shows the pre-write rows until staleTime.
const overlappingRead = (queryClient: QueryClient, queryKey: readonly unknown[]) => {
  const gate = deferred<void>();
  let reads = 0;
  const observer = new QueryObserver(queryClient, {
    queryKey,
    queryFn: async () => {
      reads += 1;
      if (reads === 1) {
        await gate.promise;
        return "before the write";
      }
      return "after the write";
    },
  });
  const unsubscribe = observer.subscribe(() => {});
  return { unsubscribe, releaseStaleRead: gate.resolve, reads: () => reads };
};

describe("settleLibraryReads", () => {
  it("discards a library read that overlapped the write and re-reads for the mounted observer", async () => {
    const queryClient = new QueryClient();
    const key = queryKeys.tracks.indexInfinite("date_added_desc");
    const read = overlappingRead(queryClient, key);
    await tick();

    await settleLibraryReads(queryClient);
    read.releaseStaleRead();
    await until(() => queryClient.getQueryData(key) === "after the write");

    expect(read.reads()).toBe(2);
    read.unsubscribe();
  });

  it("keeps the rows a mounted list already shows while the overlapped read is re-issued", async () => {
    const queryClient = new QueryClient();
    const key = queryKeys.tracks.likedPageInfinite();
    queryClient.setQueryData(key, "shown rows");
    // Stale on mount (staleTime 0), so subscribing starts the overlapping read.
    const read = overlappingRead(queryClient, key);
    await tick();
    expect(queryClient.isFetching({ queryKey: key })).toBe(1);

    await settleLibraryReads(queryClient);

    expect(queryClient.getQueryData(key)).toBe("shown rows");
    read.releaseStaleRead();
    await until(() => queryClient.getQueryData(key) === "after the write");
    read.unsubscribe();
  });

  // The list asked for its next page and is waiting on it; a re-read of the
  // loaded pages alone leaves it with the same row count, and the scroller
  // only asks again once that count changes.
  it("re-issues the next page a mounted list was fetching when the write landed", async () => {
    const queryClient = new QueryClient();
    const key = queryKeys.tracks.indexInfinite("date_added_desc");
    const gate = deferred<void>();
    let reads = 0;
    const observer = new InfiniteQueryObserver(queryClient, {
      queryKey: key,
      initialPageParam: 0,
      getNextPageParam: (last: { rows: string; next: number | null }) => last.next,
      queryFn: async ({ pageParam }) => {
        reads += 1;
        if (pageParam === 1 && reads === 2) {
          await gate.promise;
          return { rows: "page 1 before the write", next: null };
        }
        return { rows: `page ${pageParam}`, next: pageParam === 0 ? 1 : null };
      },
    });
    const unsubscribe = observer.subscribe(() => {});
    await until(() => observer.getCurrentResult().data?.pages.length === 1);
    observer.fetchNextPage();
    await tick();
    expect(queryClient.isFetching({ queryKey: key })).toBe(1);

    await settleLibraryReads(queryClient);
    gate.resolve();
    await until(() => observer.getCurrentResult().data?.pages.length === 2);

    expect(observer.getCurrentResult().data?.pages[1].rows).toBe("page 1");
    unsubscribe();
  });

  it("does not touch a remote catalog read", async () => {
    const queryClient = new QueryClient();
    const key = queryKeys.source.artists("nd");
    const read = overlappingRead(queryClient, key);
    await tick();

    await settleLibraryReads(queryClient);
    read.releaseStaleRead();
    await until(() => queryClient.getQueryData(key) !== undefined);

    expect(queryClient.getQueryData(key)).toBe("before the write");
    expect(read.reads()).toBe(1);
    read.unsubscribe();
  });

  it("is a no-op while nothing is being read", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.library.summary(), "summary");

    await settleLibraryReads(queryClient);

    expect(queryClient.getQueryData(queryKeys.library.summary())).toBe("summary");
    expect(queryClient.isFetching()).toBe(0);
  });
});
