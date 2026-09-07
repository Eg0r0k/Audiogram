import { describe, expect, it } from "vitest";
import { playback, registerPlaybackPort, type PlaybackPort } from "../playback-port";

const fakePort = (): PlaybackPort => ({
  currentTrack: null,
  currentTime: 0,
  canSeek: false,
  isPlaybackIntended: false,
  presentTrack: () => {},
  selectTrack: () => {},
  playPlayerTrack: async () => {},
  restartCurrent: async () => false,
  stop: () => {},
  clearCurrentTrack: () => {},
  seekTo: () => {},
});

describe("playback port", () => {
  it("throws until the player registers itself", () => {
    registerPlaybackPort(null);
    expect(() => playback()).toThrow(/PlaybackPort is not registered/);
  });

  it("returns the registered port", () => {
    const port = fakePort();
    registerPlaybackPort(port);
    expect(playback()).toBe(port);
  });
});
