import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlayerStore } from "../store/player.store";

describe("player.store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe("initial state", () => {
    it("should have correct default values", () => {
      const store = usePlayerStore();

      expect(store.volume).toBe(1);
      expect(store.isMuted).toBe(false);
      expect(store.repeatMode).toBe("off");
      expect(store.status).toBe("idle");
      expect(store.currentTrack).toBe(null);
      expect(store.currentTime).toBe(0);
      expect(store.duration).toBe(0);
      expect(store.graphRevision).toBe(0);
      expect(store.trackEndedSignal).toBe(0);
      expect(store.lyrics).toEqual([]);
      expect(store.lyricsStatus).toBe("idle");
      expect(store.sleepTimerEndsAt).toBe(null);
      expect(store.sleepTimerRemainingMs).toBe(0);
      expect(store.isSleepTimerActive).toBe(false);
    });
  });

  describe("computed states", () => {
    it("should compute isPlaying correctly for different states", () => {
      const store = usePlayerStore();

      store.status = "playing";
      expect(store.isPlaying).toBe(true);

      store.status = "buffering";
      expect(store.isPlaying).toBe(true);

      store.status = "idle";
      expect(store.isPlaying).toBe(false);

      store.status = "paused";
      expect(store.isPlaying).toBe(false);

      store.status = "error";
      expect(store.isPlaying).toBe(false);

      store.status = "loading";
      expect(store.isPlaying).toBe(false);
    });

    it("should compute isLoading correctly", () => {
      const store = usePlayerStore();

      store.status = "loading";
      expect(store.isLoading).toBe(true);

      store.status = "playing";
      expect(store.isLoading).toBe(false);

      store.status = "idle";
      expect(store.isLoading).toBe(false);
    });

    it("should compute progress correctly", () => {
      const store = usePlayerStore();

      store.duration = 100;
      store.currentTime = 25;
      expect(store.progress).toBe(25);

      store.currentTime = 50;
      expect(store.progress).toBe(50);

      store.duration = 0;
      expect(store.progress).toBe(0);

      store.duration = -10;
      store.currentTime = 50;
      expect(store.progress).toBe(0);
    });

    it("should compute canPlay when player is ready", () => {
      const store = usePlayerStore();
      store.player = { isReady: true } as unknown as NonNullable<typeof store.player>;
      expect(store.canPlay).toBe(true);
    });

    it("should compute canPlay when player is not ready", () => {
      const store = usePlayerStore();
      store.player = { isReady: false } as unknown as NonNullable<typeof store.player>;
      expect(store.canPlay).toBe(false);
    });

    it("should compute canPlay when player is null", () => {
      const store = usePlayerStore();
      expect(store.canPlay).toBe(false);
    });

    it("should compute canSeek correctly", () => {
      const store = usePlayerStore();

      store.player = {} as NonNullable<typeof store.player>;
      store.duration = 100;
      expect(store.canSeek).toBe(true);

      store.duration = 0;
      expect(store.canSeek).toBe(false);
    });

    it("should not allow seek when player is null", () => {
      const store = usePlayerStore();
      expect(store.canSeek).toBe(false);
    });

    it("should not allow seek for live streams", () => {
      const store = usePlayerStore();
      store.player = {} as NonNullable<typeof store.player>;
      store.duration = 0;
      store.currentTrack = { url: "stream.m3u8" } as NonNullable<typeof store.currentTrack>;

      expect(store.isLiveStream).toBe(true);
      expect(store.canSeek).toBe(false);
    });
  });

  describe("isLiveStream detection", () => {
    it("should not be live stream when no track is playing", () => {
      const store = usePlayerStore();
      store.duration = 0;
      store.currentTrack = null;

      expect(store.isLiveStream).toBe(false);
    });

    it("should be live stream for HLS URL with duration 0", () => {
      const store = usePlayerStore();
      store.duration = 0;
      store.currentTrack = { url: "https://example.com/stream.m3u8" } as NonNullable<typeof store.currentTrack>;

      expect(store.isLiveStream).toBe(true);
    });

    it("should not be live stream for regular audio", () => {
      const store = usePlayerStore();
      store.duration = 180;
      store.currentTrack = { url: "https://example.com/song.mp3" } as NonNullable<typeof store.currentTrack>;

      expect(store.isLiveStream).toBe(false);
    });

    it("should not be live stream when duration > 0", () => {
      const store = usePlayerStore();
      store.duration = 180;
      store.currentTrack = { storagePath: "song.mp3" } as NonNullable<typeof store.currentTrack>;

      expect(store.isLiveStream).toBe(false);
    });

    it("should be live stream when duration is 0 with track", () => {
      const store = usePlayerStore();
      store.duration = 0;
      store.currentTrack = { storagePath: "stream.mp3" } as NonNullable<typeof store.currentTrack>;

      expect(store.isLiveStream).toBe(true);
    });
  });

  describe("volume controls", () => {
    it("should set volume within valid range", () => {
      const store = usePlayerStore();

      store.setVolume(0.5);
      expect(store.volume).toBe(0.5);

      store.setVolume(0);
      expect(store.volume).toBe(0);

      store.setVolume(1);
      expect(store.volume).toBe(1);

      store.setVolume(1.5);
      expect(store.volume).toBe(1.5);

      store.setVolume(-0.5);
      expect(store.volume).toBe(-0.5);
    });

    it("should set muted state", () => {
      const store = usePlayerStore();

      store.setMuted(true);
      expect(store.isMuted).toBe(true);

      store.setMuted(false);
      expect(store.isMuted).toBe(false);
    });

    it("should call player method when setVolume", () => {
      const store = usePlayerStore();
      const mockSetVolume = vi.fn();
      store.player = { setVolume: mockSetVolume } as unknown as NonNullable<typeof store.player>;

      store.setVolume(0.8);
      expect(mockSetVolume).toHaveBeenCalledWith(0.8);
    });

    it("should call player method when setMuted", () => {
      const store = usePlayerStore();
      const mockSetMuted = vi.fn();
      store.player = { setMuted: mockSetMuted } as unknown as NonNullable<typeof store.player>;

      store.setMuted(true);
      expect(mockSetMuted).toHaveBeenCalledWith(true);
    });

    it("should call player toggleMute", () => {
      const store = usePlayerStore();
      const mockToggleMute = vi.fn();
      store.player = { toggleMute: mockToggleMute } as unknown as NonNullable<typeof store.player>;

      store.toggleMute();
      expect(mockToggleMute).toHaveBeenCalled();
    });
  });

  describe("seek controls", () => {
    it("should seek to specific time when allowed", () => {
      const store = usePlayerStore();
      const mockSeek = vi.fn();
      store.player = { seek: mockSeek } as unknown as NonNullable<typeof store.player>;
      store.duration = 100;

      store.seekTo(50);
      expect(mockSeek).toHaveBeenCalledWith(50);
    });

    it("should not seek when canSeek is false", () => {
      const store = usePlayerStore();
      const mockSeek = vi.fn();
      store.player = { seek: mockSeek } as unknown as NonNullable<typeof store.player>;
      store.duration = 0;

      store.seekTo(50);
      expect(mockSeek).not.toHaveBeenCalled();
    });

    it("should not seek when player is null", () => {
      const store = usePlayerStore();
      const mockSeek = vi.fn();

      store.seekTo(50);
      expect(mockSeek).not.toHaveBeenCalled();
    });

    it("should seek by percent", () => {
      const store = usePlayerStore();
      const mockSeekPercent = vi.fn();
      store.player = { seekPercent: mockSeekPercent } as unknown as NonNullable<typeof store.player>;
      store.duration = 100;

      store.seekPercent(50);
      expect(mockSeekPercent).toHaveBeenCalledWith(0.5);
    });

    it("should not seekPercent when canSeek is false", () => {
      const store = usePlayerStore();
      const mockSeekPercent = vi.fn();
      store.player = { seekPercent: mockSeekPercent } as unknown as NonNullable<typeof store.player>;
      store.duration = 0;

      store.seekPercent(50);
      expect(mockSeekPercent).not.toHaveBeenCalled();
    });
  });

  describe("repeat mode", () => {
    it("should cycle through repeat modes", () => {
      const store = usePlayerStore();

      expect(store.repeatMode).toBe("off");
      store.toggleRepeat();
      expect(store.repeatMode).toBe("all");
      store.toggleRepeat();
      expect(store.repeatMode).toBe("one");
      store.toggleRepeat();
      expect(store.repeatMode).toBe("off");
    });

    it("should handle all repeat modes explicitly", () => {
      const store = usePlayerStore();

      store.repeatMode = "off";
      store.toggleRepeat();
      expect(store.repeatMode).toBe("all");

      store.repeatMode = "all";
      store.toggleRepeat();
      expect(store.repeatMode).toBe("one");

      store.repeatMode = "one";
      store.toggleRepeat();
      expect(store.repeatMode).toBe("off");
    });
  });

  describe("toggle play/pause logic", () => {
    it("should not be playing when status is idle", () => {
      const store = usePlayerStore();
      store.status = "idle";
      expect(store.isPlaying).toBe(false);
    });

    it("should not be playing when status is paused", () => {
      const store = usePlayerStore();
      store.status = "paused";
      expect(store.isPlaying).toBe(false);
    });

    it("should be playing when status is playing", () => {
      const store = usePlayerStore();
      store.status = "playing";
      expect(store.isPlaying).toBe(true);
    });

    it("should be playing when status is buffering", () => {
      const store = usePlayerStore();
      store.status = "buffering";
      expect(store.isPlaying).toBe(true);
    });
  });

  describe("stop functionality", () => {
    it("should stop player and reset time when player exists", () => {
      const store = usePlayerStore();
      const mockStop = vi.fn();
      store.player = {
        stop: mockStop,
        fadeOut: vi.fn().mockResolvedValue(undefined),
      } as unknown as NonNullable<typeof store.player>;
      store.currentTime = 50;

      store.stop();
      expect(mockStop).toHaveBeenCalled();
      expect(store.currentTime).toBe(0);
    });

    it("should not call stop when player is null", () => {
      const store = usePlayerStore();
      store.currentTime = 50;

      store.stop();
      expect(store.currentTime).toBe(50);
    });
  });

  describe("dispose functionality", () => {
    it("should dispose player when player exists", async () => {
      const store = usePlayerStore();
      const mockDispose = vi.fn().mockResolvedValue(undefined);
      store.player = { dispose: mockDispose } as unknown as NonNullable<typeof store.player>;

      await store.dispose();

      expect(mockDispose).toHaveBeenCalled();
      expect(store.player).toBe(null);
    });

    it("should do nothing when player is null", async () => {
      const store = usePlayerStore();

      await store.dispose();

      expect(store.player).toBe(null);
    });
  });

  describe("sleep timer", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-06T12:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should activate sleep timer and expose remaining time", () => {
      const store = usePlayerStore();

      store.setSleepTimer(5 * 60 * 1000);

      expect(store.isSleepTimerActive).toBe(true);
      expect(store.sleepTimerEndsAt).toBe(Date.now() + 5 * 60 * 1000);
      expect(store.sleepTimerRemainingMs).toBe(5 * 60 * 1000);
    });

    it("should update remaining time while timer is active", () => {
      const store = usePlayerStore();

      store.setSleepTimer(5 * 1000);
      vi.advanceTimersByTime(2000);

      expect(store.sleepTimerRemainingMs).toBe(3000);
    });

    it("should cancel sleep timer", () => {
      const store = usePlayerStore();

      store.setSleepTimer(5 * 1000);
      store.cancelSleepTimer();

      expect(store.isSleepTimerActive).toBe(false);
      expect(store.sleepTimerEndsAt).toBe(null);
      expect(store.sleepTimerRemainingMs).toBe(0);
    });

    it("should cancel sleep timer for invalid duration", () => {
      const store = usePlayerStore();

      store.setSleepTimer(5 * 1000);
      store.setSleepTimer(0);

      expect(store.isSleepTimerActive).toBe(false);
      expect(store.sleepTimerEndsAt).toBe(null);
      expect(store.sleepTimerRemainingMs).toBe(0);
    });

    it("should pause playback when sleep timer expires", () => {
      const store = usePlayerStore();
      const mockPause = vi.fn();

      store.player = { pause: mockPause } as unknown as NonNullable<typeof store.player>;
      store.status = "playing";

      store.setSleepTimer(5 * 1000);
      vi.advanceTimersByTime(5000);

      expect(mockPause).toHaveBeenCalledTimes(1);
      expect(store.isSleepTimerActive).toBe(false);
      expect(store.sleepTimerRemainingMs).toBe(0);
    });

    it("should clear sleep timer on dispose", async () => {
      const store = usePlayerStore();
      const mockDispose = vi.fn().mockResolvedValue(undefined);

      store.player = { dispose: mockDispose } as unknown as NonNullable<typeof store.player>;
      store.setSleepTimer(5 * 1000);

      await store.dispose();

      expect(store.isSleepTimerActive).toBe(false);
      expect(store.sleepTimerEndsAt).toBe(null);
      expect(store.sleepTimerRemainingMs).toBe(0);
    });
  });

  describe("getAudioGraph", () => {
    it("should return null when player is null", () => {
      const store = usePlayerStore();
      expect(store.getAudioGraph()).toBe(null);
    });

    it("should return graph when player exists", () => {
      const store = usePlayerStore();
      const mockGraph = {};
      store.player = { graph: mockGraph } as unknown as NonNullable<typeof store.player>;

      expect(store.getAudioGraph()).toBe(mockGraph);
    });

    it("should return null when graph is undefined", () => {
      const store = usePlayerStore();
      store.player = { graph: undefined } as unknown as NonNullable<typeof store.player>;

      expect(store.getAudioGraph()).toBe(null);
    });
  });

  describe("trackEndedSignal", () => {
    it("should increment trackEndedSignal", () => {
      const store = usePlayerStore();
      expect(store.trackEndedSignal).toBe(0);

      store.trackEndedSignal = 1;
      expect(store.trackEndedSignal).toBe(1);
    });
  });

  describe("graphRevision", () => {
    it("should start at 0", () => {
      const store = usePlayerStore();
      expect(store.graphRevision).toBe(0);
    });

    it("should be updatable", () => {
      const store = usePlayerStore();
      store.graphRevision = 5;
      expect(store.graphRevision).toBe(5);
    });
  });

  describe("currentTime and duration", () => {
    it("should track currentTime", () => {
      const store = usePlayerStore();
      store.currentTime = 30;
      expect(store.currentTime).toBe(30);
    });

    it("should track duration", () => {
      const store = usePlayerStore();
      store.duration = 180;
      expect(store.duration).toBe(180);
    });

    it("should compute progress with various values", () => {
      const store = usePlayerStore();

      store.duration = 100;
      store.currentTime = 0;
      expect(store.progress).toBe(0);

      store.currentTime = 100;
      expect(store.progress).toBe(100);

      store.currentTime = 33.33;
      expect(store.progress).toBeCloseTo(33.33, 1);
    });
  });
});
