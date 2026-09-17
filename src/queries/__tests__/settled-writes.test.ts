import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/vue-query";
import { TrackId } from "@/types/ids";
import type { TrackEntity } from "@/db/entities";

vi.mock("@/modules/covers/lib/cover-cache", () => ({
  coverCache: { invalidateAll: vi.fn(), invalidate: vi.fn(), set: vi.fn() },
}));

import { invalidateLibraryData } from "../library.queries";
import { syncLocalCopyCache } from "../localCopy.queries";
import { queryKeys } from "../query-keys";

//
// A read that started before a write answers with the pre-write rows. On its
// first load it has no data for invalidateQueries to cancel and refetch: the
// refetch joins it, and the stale answer lands as if it were fresh. Every
// write path that does not go through the mutation registry has to settle
// the overlapped reads itself.
//

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

const overlappingFirstLoad = (queryClient: QueryClient, queryKey: readonly unknown[]) => {
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

describe("invalidateLibraryData", () => {
  it("discards a first-load summary read that overlapped the bulk write", async () => {
    const queryClient = new QueryClient();
    const key = queryKeys.library.summary();
    const read = overlappingFirstLoad(queryClient, key);
    await tick();

    const invalidated = invalidateLibraryData(queryClient);
    read.releaseStaleRead();
    await invalidated;
    await until(() => queryClient.isFetching({ queryKey: key }) === 0);

    expect(queryClient.getQueryData(key)).toBe("after the write");
    read.unsubscribe();
  });
});

describe("syncLocalCopyCache", () => {
  const remoteId = TrackId("nd:1");
  const copy = { id: TrackId("local:1"), storagePath: "tracks/1.m4a", sourceRef: remoteId } as TrackEntity;

  it("keeps the written copy over a first-load read that overlapped the write", async () => {
    const queryClient = new QueryClient();
    const key = queryKeys.tracks.localCopy(remoteId);
    const read = overlappingFirstLoad(queryClient, key);
    await tick();

    await syncLocalCopyCache(queryClient, remoteId, copy);
    read.releaseStaleRead();
    await until(() => queryClient.isFetching({ queryKey: key }) === 0);

    // Either the written copy or the re-read row; never the pre-write answer.
    expect(queryClient.getQueryData(key)).not.toBe("before the write");
    expect(read.reads()).toBe(2);
    read.unsubscribe();
  });
});
