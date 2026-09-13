import { describe, expect, it } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/vue-query";
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
