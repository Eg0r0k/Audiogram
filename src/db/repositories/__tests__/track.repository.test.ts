import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AlbumId } from "@/types/ids";

// The membership counts moved to track.repository.paging.idb.test.ts and
// album paging to queries/__tests__/album-tracks-paging.integration.test.ts:
// both are answered by index ranges or a cached order now, which a
// hand-rolled table double cannot stand in for.
const table = vi.hoisted(() => {
  const equalsToArrayMock = vi.fn();
  const equalsMock = vi.fn(() => ({ toArray: equalsToArrayMock }));
  const whereMock = vi.fn(() => ({ equals: equalsMock }));
  return { equalsToArrayMock, equalsMock, whereMock };
});

vi.mock("@/db", () => ({
  db: {
    tracks: {
      where: table.whereMock,
    },
  },
}));

import { trackRepository } from "../track.repository";

describe("trackRepository.findByAlbumId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("orders by (diskNo, trackNo) and places tracks without a number first", async () => {
    table.equalsToArrayMock.mockResolvedValue([
      { id: "t2", trackNo: 2 },
      { id: "noNo" }, // trackNo undefined → treated as 0, must not break the sort
      { id: "d2t1", diskNo: 2, trackNo: 1 },
      { id: "t1", trackNo: 1 },
    ]);

    const result = await trackRepository.findByAlbumId("album-1" as AlbumId);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().map(t => t.id)).toEqual(["noNo", "t1", "t2", "d2t1"]);

    expect(table.whereMock).toHaveBeenCalledWith("albumId");
    expect(table.equalsMock).toHaveBeenCalledWith("album-1");
  });
});
