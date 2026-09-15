import { describe, expect, it, vi } from "vitest";
import { TrackSource, TrackState } from "@/db/entities";
import type { SourceTrackDTO } from "@/types/source-dto";
import type { Track } from "../types";

vi.mock("@/db/storage", () => ({ storageService: { getAudioUrl: vi.fn() } }));
vi.mock("@/db/repositories", () => ({ offlineCopyRepository: { findById: vi.fn() } }));
vi.mock("@/modules/sources", () => ({ sources: { get: vi.fn(), forTrack: vi.fn() } }));
vi.mock("@/lib/environment/platformCaps", () => ({ platformCaps: { hasFs: true } }));
vi.mock("@/modules/tracks/service/ensurePinned", () => ({ ensurePinned: vi.fn() }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ warn: vi.fn(), error: vi.fn() }) }));

import { checkPlayable } from "../service/playback-resolver.service";

const catalogRow = (availability: SourceTrackDTO["availability"]): Track => ({
  id: "nd:s1" as never,
  kind: "library",
  title: "Locked",
  artist: "Artist",
  artistIds: [],
  albumId: "" as never,
  albumName: "",
  storagePath: "",
  source: TrackSource.REMOTE_SUBSONIC,
  state: TrackState.READY,
  duration: 200,
  isLiked: false,
  sourceDto: { id: "nd:s1" as never, title: "Locked", availability },
});

describe("checkPlayable and catalog availability", () => {
  it("refuses a row its source marked unavailable before any switch starts", () => {
    const result = checkPlayable(catalogRow("unavailable"));

    expect(result._unsafeUnwrapErr()).toEqual({
      kind: "unavailable",
      reason: expect.stringContaining("not available"),
    });
  });

  it("lets a preview row play — the source serves what it can", () => {
    expect(checkPlayable(catalogRow("preview")).isOk()).toBe(true);
  });

  it("treats a DTO without the field as fully available", () => {
    expect(checkPlayable(catalogRow(undefined)).isOk()).toBe(true);
  });
});
