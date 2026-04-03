/* eslint-disable @typescript-eslint/no-explicit-any */
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackSource } from "@/db/entities";
import { usePlayerStore } from "@/modules/player/store/player.store";
import type { Track } from "@/modules/player/types";
import { useQueueStore } from "../store/queue.store";

function createTrack(id: string, title: string = "Test Track"): Track {
  return {
    id: id as Track["id"],
    title,
    artist: "Artist",
    artistId: "artist-1" as Track["artistId"],
    albumId: "album-1" as Track["albumId"],
    albumName: "Album",
    storagePath: `tracks/${id}.mp3`,
    source: TrackSource.LOCAL_INTERNAL,
    duration: 120,
    isLiked: false,
  };
}

describe("queue.store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe("initial state", () => {
    it("should have empty queue by default", () => {
      const store = useQueueStore();

      expect(store.queue).toEqual([]);
      expect(store.originalQueue).toEqual([]);
      expect(store.currentIndex).toBe(-1);
      expect(store.isShuffled).toBe(false);
    });

    it("should compute isEmpty correctly", () => {
      const store = useQueueStore();

      expect(store.isEmpty).toBe(true);

      store.queue = [{ id: "1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() }];
      expect(store.isEmpty).toBe(false);
    });

    it("should compute size correctly", () => {
      const store = useQueueStore();

      expect(store.size).toBe(0);

      store.queue = [
        { id: "1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      expect(store.size).toBe(2);
    });
  });

  describe("computed properties", () => {
    it("should compute currentItem correctly", () => {
      const store = useQueueStore();
      const track = createTrack("1");
      store.queue = [
        { id: "item-1" as any, track, source: { type: "manual" as const }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;

      expect(store.currentItem?.track).toStrictEqual(track);
    });

    it("should return null for currentItem when index is -1", () => {
      const store = useQueueStore();
      store.queue = [{ id: "1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() }];
      store.currentIndex = -1;

      expect(store.currentItem).toBe(null);
    });

    it("should compute currentTrack correctly", () => {
      const store = useQueueStore();
      const track = createTrack("1");
      store.queue = [{ id: "item-1" as any, track, source: { type: "manual" as const }, addedAt: Date.now() }];
      store.currentIndex = 0;

      expect(store.currentTrack).toStrictEqual(track);
    });

    it("should compute hasNext correctly", () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();

      store.queue = [
        { id: "1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;
      playerStore.repeatMode = "off";

      expect(store.hasNext).toBe(true);

      store.currentIndex = 1;
      expect(store.hasNext).toBe(false);

      playerStore.repeatMode = "all";
      expect(store.hasNext).toBe(true);
    });

    it("should compute hasPrevious correctly", () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();

      store.queue = [
        { id: "1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 1;
      playerStore.repeatMode = "off";

      expect(store.hasPrevious).toBe(true);

      store.currentIndex = 0;
      expect(store.hasPrevious).toBe(false);

      playerStore.repeatMode = "all";
      expect(store.hasPrevious).toBe(true);
    });

    it("should compute upcomingItems correctly", () => {
      const store = useQueueStore();

      store.queue = [
        { id: "1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "3" as any, track: createTrack("3"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;

      expect(store.upcomingItems).toHaveLength(2);
      expect(store.upcomingItems[0].track.id).toBe("2");
      expect(store.upcomingItems[1].track.id).toBe("3");
    });

    it("should compute previousItems correctly", () => {
      const store = useQueueStore();

      store.queue = [
        { id: "1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "3" as any, track: createTrack("3"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 2;

      expect(store.previousItems).toHaveLength(2);
      expect(store.previousItems[0].track.id).toBe("1");
      expect(store.previousItems[1].track.id).toBe("2");
    });
  });

  describe("setQueue", () => {
    it("should set queue and start playing at index", async () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();
      const playPlayerTrackSpy = vi.spyOn(playerStore, "playPlayerTrack").mockResolvedValue(undefined);

      const tracks = [createTrack("1"), createTrack("2")];
      await store.setQueue(tracks, 1);

      expect(store.queue).toHaveLength(2);
      expect(store.currentIndex).toBe(1);
      expect(playPlayerTrackSpy).toHaveBeenCalledWith(tracks[1]);
    });

    it("should clear queue for empty tracks array", async () => {
      const store = useQueueStore();
      store.queue = [{ id: "1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() }];
      store.currentIndex = 0;

      await store.setQueue([]);

      expect(store.isEmpty).toBe(true);
      expect(store.currentIndex).toBe(-1);
    });
  });

  describe("addToQueue", () => {
    it("should add single track to queue", () => {
      const store = useQueueStore();
      const track = createTrack("1");

      store.addToQueue(track);

      expect(store.queue).toHaveLength(1);
      expect(store.queue[0].track).toStrictEqual(track);
    });
  });

  describe("addMultipleToQueue", () => {
    it("should add multiple tracks to queue", () => {
      const store = useQueueStore();
      const tracks = [createTrack("1"), createTrack("2"), createTrack("3")];

      store.addMultipleToQueue(tracks);

      expect(store.queue).toHaveLength(3);
    });
  });

  describe("insertNext", () => {
    it("should insert track after current track", () => {
      const store = useQueueStore();
      const track1 = createTrack("1");
      const track2 = createTrack("2");
      const trackToInsert = createTrack("insert");

      store.queue = [
        { id: "item-1" as any, track: track1, source: { type: "manual" as const }, addedAt: Date.now() },
        { id: "item-2" as any, track: track2, source: { type: "manual" as const }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;

      store.insertNext(trackToInsert);

      expect(store.queue[1].track).toStrictEqual(trackToInsert);
    });

    it("should insert at beginning when no current track", () => {
      const store = useQueueStore();
      const track = createTrack("1");
      const trackToInsert = createTrack("insert");

      store.queue = [{ id: "item-1" as any, track, source: { type: "manual" as const }, addedAt: Date.now() }];
      store.currentIndex = -1;

      store.insertNext(trackToInsert);

      expect(store.queue[0].track).toStrictEqual(trackToInsert);
    });
  });

  describe("removeFromQueue", () => {
    it("should remove track by id", () => {
      const store = useQueueStore();
      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;

      store.removeFromQueue("item-2" as any);

      expect(store.queue).toHaveLength(1);
      expect(store.queue[0].track.id).toBe("1");
    });

    it("should update currentIndex when removing item before current", () => {
      const store = useQueueStore();
      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-3" as any, track: createTrack("3"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 2;

      store.removeFromQueue("item-1" as any);

      expect(store.currentIndex).toBe(1);
    });
  });

  describe("removeMultiple", () => {
    it("should remove multiple tracks by ids", () => {
      const store = useQueueStore();
      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-3" as any, track: createTrack("3"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;

      store.removeMultiple(["item-1" as any, "item-3" as any]);

      expect(store.queue).toHaveLength(1);
      expect(store.queue[0].track.id).toBe("2");
    });
  });

  describe("moveTrack", () => {
    it("should move track from one position to another", () => {
      const store = useQueueStore();
      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-3" as any, track: createTrack("3"), source: { type: "manual" }, addedAt: Date.now() },
      ];

      store.moveTrack(0, 2);

      expect(store.queue[0].track.id).toBe("2");
      expect(store.queue[2].track.id).toBe("1");
    });

    it("should update currentIndex when moving current track", () => {
      const store = useQueueStore();
      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;

      store.moveTrack(0, 1);

      expect(store.currentIndex).toBe(1);
    });
  });

  describe("shuffle", () => {
    it("should shuffle queue but keep current track first", () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();
      vi.spyOn(playerStore, "playPlayerTrack").mockResolvedValue(undefined);

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-3" as any, track: createTrack("3"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;

      store.shuffle();

      expect(store.isShuffled).toBe(true);
      expect(store.queue[0].track.id).toBe("1");
      expect(store.queue).toHaveLength(3);
    });

    it("should not shuffle if queue has 1 or fewer items", () => {
      const store = useQueueStore();
      store.queue = [{ id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() }];

      store.shuffle();

      expect(store.isShuffled).toBe(false);
    });
  });

  describe("unshuffle", () => {
    it("should restore original queue", () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();
      vi.spyOn(playerStore, "playPlayerTrack").mockResolvedValue(undefined);

      const originalQueue: typeof store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" as const }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" as const }, addedAt: Date.now() },
      ];
      store.queue = [...originalQueue];
      store.originalQueue = [...originalQueue];
      store.isShuffled = true;
      store.currentIndex = 0;

      store.unshuffle();

      expect(store.isShuffled).toBe(false);
      expect(store.queue).toEqual(originalQueue);
    });
  });

  describe("clear", () => {
    it("should clear queue and reset state", () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();
      vi.spyOn(playerStore, "stop").mockReturnValue(undefined);

      store.queue = [{ id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() }];
      store.originalQueue = [{ id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() }];
      store.currentIndex = 0;
      store.isShuffled = true;

      store.clear();

      expect(store.queue).toEqual([]);
      expect(store.originalQueue).toEqual([]);
      expect(store.currentIndex).toBe(-1);
      expect(store.isShuffled).toBe(false);
    });
  });

  describe("syncTrackMetadata", () => {
    it("should update track metadata in queue", () => {
      const store = useQueueStore();
      const track1 = createTrack("1");
      const track2 = createTrack("2");
      store.queue = [
        { id: "item-1" as any, track: track1, source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-2" as any, track: track2, source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.originalQueue = [...store.queue];

      store.syncTrackMetadata({ ...track1, lyricsPath: "lyrics/1.lrc" } as Track);

      expect((store.queue[0].track as Track).lyricsPath).toBe("lyrics/1.lrc");
      expect((store.originalQueue[0].track as Track).lyricsPath).toBe("lyrics/1.lrc");
    });
  });

  describe("jumpTo", () => {
    it("should jump to specific index and play", async () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();
      const playSpy = vi.spyOn(playerStore, "playPlayerTrack").mockResolvedValue(undefined);

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" as const }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" as const }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;

      await store.jumpTo(1);

      expect(store.currentIndex).toBe(1);
      expect(playSpy).toHaveBeenCalledWith(createTrack("2"));
    });
  });

  describe("jumpToId", () => {
    it("should jump to track by id", async () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();
      vi.spyOn(playerStore, "playPlayerTrack").mockResolvedValue(undefined);

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" as const }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" as const }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;

      await store.jumpToId("item-2" as any);

      expect(store.currentIndex).toBe(1);
    });

    it("should do nothing when id not found", async () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();
      const playSpy = vi.spyOn(playerStore, "playPlayerTrack").mockResolvedValue(undefined);

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" as const }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;

      await store.jumpToId("non-existent-id" as any);

      expect(playSpy).not.toHaveBeenCalled();
      expect(store.currentIndex).toBe(0);
    });
  });

  describe("next", () => {
    it("should go to next track when not at end", async () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();
      const playSpy = vi.spyOn(playerStore, "playPlayerTrack").mockResolvedValue(undefined);

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;
      playerStore.repeatMode = "off";

      await store.next();

      expect(store.currentIndex).toBe(1);
      expect(playSpy).toHaveBeenCalledWith(createTrack("2"));
    });

    it("should restart current track in repeat-one mode", async () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();
      const playSpy = vi.spyOn(playerStore, "playPlayerTrack").mockResolvedValue(undefined);

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;
      playerStore.repeatMode = "one";

      await store.next();

      expect(store.currentIndex).toBe(0);
      expect(playSpy).toHaveBeenCalledWith(createTrack("1"));
    });

    it("should loop to start in repeat-all mode", async () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();
      const playSpy = vi.spyOn(playerStore, "playPlayerTrack").mockResolvedValue(undefined);

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 1;
      playerStore.repeatMode = "all";

      await store.next();

      expect(store.currentIndex).toBe(0);
      expect(playSpy).toHaveBeenCalledWith(createTrack("1"));
    });

    it("should stop when at end with repeat off", async () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();
      const stopSpy = vi.spyOn(playerStore, "stop").mockReturnValue(undefined);

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 1;
      playerStore.repeatMode = "off";

      await store.next();

      expect(store.currentIndex).toBe(-1);
      expect(stopSpy).toHaveBeenCalled();
    });

    it("should do nothing when queue is empty", async () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();
      const playSpy = vi.spyOn(playerStore, "playPlayerTrack").mockResolvedValue(undefined);

      store.queue = [];
      store.currentIndex = -1;

      await store.next();

      expect(playSpy).not.toHaveBeenCalled();
    });
  });

  describe("previous", () => {
    it("should go to previous track when not at start", async () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();
      const playSpy = vi.spyOn(playerStore, "playPlayerTrack").mockResolvedValue(undefined);

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 1;
      playerStore.currentTime = 1;

      await store.previous();

      expect(store.currentIndex).toBe(0);
      expect(playSpy).toHaveBeenCalledWith(createTrack("1"));
    });

    it("should restart current track when currentTime > RESTART_THRESHOLD", async () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();
      const seekSpy = vi.spyOn(playerStore, "seekTo").mockReturnValue(undefined);

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;
      playerStore.currentTime = 5;

      await store.previous();

      expect(seekSpy).toHaveBeenCalledWith(0);
    });

    it("should loop to end in repeat-all mode", async () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();
      const playSpy = vi.spyOn(playerStore, "playPlayerTrack").mockResolvedValue(undefined);

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;
      playerStore.currentTime = 1;
      playerStore.repeatMode = "all";

      await store.previous();

      expect(store.currentIndex).toBe(1);
      expect(playSpy).toHaveBeenCalledWith(createTrack("2"));
    });

    it("should seek to 0 when at start with repeat off", async () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();
      const seekSpy = vi.spyOn(playerStore, "seekTo").mockReturnValue(undefined);

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;
      playerStore.currentTime = 1;
      playerStore.repeatMode = "off";

      await store.previous();

      expect(seekSpy).toHaveBeenCalledWith(0);
    });

    it("should do nothing when queue is empty", async () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();
      const playSpy = vi.spyOn(playerStore, "playPlayerTrack").mockResolvedValue(undefined);

      store.queue = [];

      await store.previous();

      expect(playSpy).not.toHaveBeenCalled();
    });
  });

  describe("toggleShuffle", () => {
    it("should shuffle when not shuffled", () => {
      const store = useQueueStore();

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;
      store.isShuffled = false;

      store.toggleShuffle();

      expect(store.isShuffled).toBe(true);
    });

    it("should unshuffle when already shuffled", () => {
      const store = useQueueStore();

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.originalQueue = [...store.queue];
      store.isShuffled = true;

      store.toggleShuffle();

      expect(store.isShuffled).toBe(false);
    });
  });

  describe("removeFromQueue edge cases", () => {
    it("should stop player when removing last item", () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();
      const stopSpy = vi.spyOn(playerStore, "stop").mockReturnValue(undefined);

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;

      store.removeFromQueue("item-1" as any);

      expect(stopSpy).toHaveBeenCalled();
      expect(store.currentIndex).toBe(-1);
    });

    it("should update currentIndex when removing after current", () => {
      const store = useQueueStore();

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;

      store.removeFromQueue("item-2" as any);

      expect(store.currentIndex).toBe(0);
    });

    it("should play next when removing current", () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();
      const playSpy = vi.spyOn(playerStore, "playPlayerTrack").mockResolvedValue(undefined);

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;

      store.removeFromQueue("item-1" as any);

      expect(playSpy).toHaveBeenCalledWith(createTrack("2"));
    });

    it("should do nothing when id not found", () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();
      const stopSpy = vi.spyOn(playerStore, "stop").mockReturnValue(undefined);

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;

      store.removeFromQueue("non-existent" as any);

      expect(store.queue).toHaveLength(1);
      expect(stopSpy).not.toHaveBeenCalled();
    });
  });

  describe("removeMultiple edge cases", () => {
    it("should stop player when all items removed", () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();
      const stopSpy = vi.spyOn(playerStore, "stop").mockReturnValue(undefined);

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;

      store.removeMultiple(["item-1" as any]);

      expect(stopSpy).toHaveBeenCalled();
      expect(store.currentIndex).toBe(-1);
    });

    it("should recalculate index after removal", () => {
      const store = useQueueStore();

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-3" as any, track: createTrack("3"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 1;

      store.removeMultiple(["item-1" as any]);

      expect(store.currentIndex).toBe(0);
    });
  });

  describe("moveTrack edge cases", () => {
    it("should do nothing when fromIndex equals toIndex", () => {
      const store = useQueueStore();

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;

      store.moveTrack(0, 0);

      expect(store.queue[0].track.id).toBe("1");
    });

    it("should decrement index when moving item before current", () => {
      const store = useQueueStore();

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-3" as any, track: createTrack("3"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 2;

      store.moveTrack(0, 2);

      expect(store.currentIndex).toBe(1);
    });

    it("should increment index when moving item after current", () => {
      const store = useQueueStore();

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-3" as any, track: createTrack("3"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;

      store.moveTrack(2, 0);

      expect(store.currentIndex).toBe(1);
    });

    it("should do nothing for invalid indices", () => {
      const store = useQueueStore();

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
      ];

      store.moveTrack(-1, 0);
      expect(store.queue[0].track.id).toBe("1");

      store.moveTrack(0, 10);
      expect(store.queue[0].track.id).toBe("1");
    });
  });

  describe("shuffle edge cases", () => {
    it("should save original queue on first shuffle", () => {
      const store = useQueueStore();

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;

      store.shuffle();

      expect(store.originalQueue).toHaveLength(2);
    });
  });

  describe("unshuffle edge cases", () => {
    it("should do nothing when not shuffled", () => {
      const store = useQueueStore();

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.originalQueue = [];
      store.isShuffled = false;

      store.unshuffle();

      expect(store.queue[0].track.id).toBe("1");
    });

    it("should do nothing when original queue is empty", () => {
      const store = useQueueStore();

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.originalQueue = [];
      store.isShuffled = true;

      store.unshuffle();

      expect(store.queue[0].track.id).toBe("1");
    });
  });

  describe("computed properties edge cases", () => {
    it("should return null when currentIndex out of bounds", () => {
      const store = useQueueStore();

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 5;

      expect(store.currentItem).toBe(null);
      expect(store.currentTrack).toBe(null);
    });

    it("should return all items when currentIndex is -1", () => {
      const store = useQueueStore();

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = -1;

      expect(store.upcomingItems).toHaveLength(2);
      expect(store.previousItems).toHaveLength(0);
    });

    it("should return empty array for previousItems when at start", () => {
      const store = useQueueStore();

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
        { id: "item-2" as any, track: createTrack("2"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;

      expect(store.previousItems).toHaveLength(0);
      expect(store.upcomingItems).toHaveLength(1);
    });

    it("should return true for hasNext with repeat all even at end", () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;
      playerStore.repeatMode = "all";

      expect(store.hasNext).toBe(true);
    });

    it("should return true for hasPrevious with repeat all even at start", () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();

      store.queue = [
        { id: "item-1" as any, track: createTrack("1"), source: { type: "manual" }, addedAt: Date.now() },
      ];
      store.currentIndex = 0;
      playerStore.repeatMode = "all";

      expect(store.hasPrevious).toBe(true);
    });

    it("should return false for hasNext when queue is empty", () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();

      store.queue = [];
      playerStore.repeatMode = "all";

      expect(store.hasNext).toBe(false);
    });

    it("should return false for hasPrevious when queue is empty", () => {
      const store = useQueueStore();
      const playerStore = usePlayerStore();

      store.queue = [];
      playerStore.repeatMode = "all";

      expect(store.hasPrevious).toBe(false);
    });
  });
});
