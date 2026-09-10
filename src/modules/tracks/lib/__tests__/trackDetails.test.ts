import { describe, expect, it } from "vitest";
import { TrackSource, TrackState } from "@/db/entities";
import { resolveTrackFormat, trackSourceLabelKey, trackStateLabelKey } from "../trackDetails";

describe("trackDetails", () => {
  it("names every source and state the UI knows", () => {
    expect(trackSourceLabelKey(TrackSource.REMOTE_SUBSONIC)).toBe("track.details.values.remoteNd");
    expect(trackSourceLabelKey(999 as TrackSource)).toBeNull();
    expect(trackStateLabelKey(TrackState.BROKEN)).toBe("track.details.values.broken");
    expect(trackStateLabelKey(999 as TrackState)).toBeNull();
  });

  it("fills format fields from the offline copy only where the row has none", () => {
    expect(resolveTrackFormat({ codec: "opus", lossless: false }, { codec: "aac", bitrate: 128000, lossless: true }))
      .toEqual({ codec: "opus", bitrate: 128000, sampleRate: undefined, channels: undefined, lossless: false });
    expect(resolveTrackFormat(undefined, undefined)).toEqual({
      codec: undefined, bitrate: undefined, sampleRate: undefined, channels: undefined, lossless: undefined,
    });
  });
});
