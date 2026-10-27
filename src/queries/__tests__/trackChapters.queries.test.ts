import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackId } from "@/types/ids";

const findByIdMock = vi.hoisted(() => vi.fn());

vi.mock("@/db/repositories/trackChapters.repository", () => ({
  trackChaptersRepository: { findById: findByIdMock },
}));

import { readTrackChapters } from "../trackChapters.queries";
import { trackChaptersRepository } from "@/db/repositories/trackChapters.repository";

describe("readTrackChapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("short-circuits the empty ephemeral-track id without touching the db", async () => {
    const result = await readTrackChapters(TrackId(""));

    // The empty id is shared by every ephemeral (YT/radio) track — a stray
    // row under it would render phantom chapter marks on all of them.
    expect(result).toEqual([]);
    expect(trackChaptersRepository.findById).not.toHaveBeenCalled();
  });

  it("returns the stored chapters for a real track id", async () => {
    findByIdMock.mockResolvedValue({
      trackId: TrackId("t1"),
      chapters: [{ time: 1770, title: "Drop" }],
      updatedAt: 1,
    });

    const result = await readTrackChapters(TrackId("t1"));

    expect(result).toEqual([{ time: 1770, title: "Drop" }]);
    expect(trackChaptersRepository.findById).toHaveBeenCalledWith("t1");
  });

  it("maps a missing row to an empty chapter list", async () => {
    findByIdMock.mockResolvedValue(undefined);

    const result = await readTrackChapters(TrackId("t2"));

    expect(result).toEqual([]);
  });
});
