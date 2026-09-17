import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { okAsync } from "neverthrow";
import { ndAlbumId, ndArtistId, ndTrackId } from "@/types/track-ref";
import { TrackSource, TrackState } from "@/db/entities";
import { AlbumId, TrackId } from "@/types/ids";
import type { ImportItem } from "@/services/types";
import type { SourceTrackDTO } from "@/modules/sources/types";

//
// End-to-end over real Dexie (fake-indexeddb): download → the player plays
// the imported local copy; removeLocalCopy → the copy is gone and the same
// remote id resolves back to live streaming.
//

const storageMock = vi.hoisted(() => ({
  importFile: vi.fn(),
  getFileSize: vi.fn(),
  getAudioUrl: vi.fn(),
  deleteFile: vi.fn(),
  warmup: vi.fn(async () => {}),
  getAppDataDir: vi.fn(async () => "C:/appdata"),
}));
const providerMock = vi.hoisted(() => ({
  downloadToFile: vi.fn(),
  resolveStreamUrl: vi.fn(),
}));
const engineMock = vi.hoisted(() => ({ importFromItems: vi.fn() }));

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/environment/userAgent", () => ({ IS_TAURI: true, IS_MOBILE: false, IS_WINDOWS: false }));
vi.mock("@/db/storage", () => ({ storageService: storageMock }));
vi.mock("@/modules/sources", () => ({
  sources: { forTrack: () => providerMock },
}));
vi.mock("@tauri-apps/plugin-fs", () => ({
  BaseDirectory: { AppData: 1 },
  readDir: vi.fn(async () => []),
  remove: vi.fn(async () => {}),
  stat: vi.fn(),
}));
vi.mock("@/queries/library.queries", () => ({
  invalidateLibraryData: vi.fn(async () => {}),
}));
// The real engine would spin up the import worker pool.
vi.mock("@/services/importer.service", () => ({ musicLibraryEngine: engineMock }));

// Player harness: only the audio layer is faked — resolution runs for real.
vi.mock("lyra-audio", () => {
  function MockPlayer() {
    return {
      dispose: vi.fn().mockResolvedValue(undefined),
      setVolume: vi.fn(),
      setMuted: vi.fn(),
      setPlaybackRate: vi.fn(),
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      stop: vi.fn(),
      seek: vi.fn(),
      load: vi.fn().mockResolvedValue(undefined),
      fadeIn: vi.fn().mockResolvedValue(undefined),
      fadeOut: vi.fn().mockResolvedValue(undefined),
      fadeTo: vi.fn().mockResolvedValue(undefined),
      seekPercent: vi.fn(),
      toggleMute: vi.fn(),
      cancelFade: vi.fn(),
      clearLoudnessMetadata: vi.fn(),
      setLoudnessMetadata: vi.fn(),
      unlockAudio: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      get isReady() { return true; },
      get isPlaying() { return false; },
      get duration() { return 0; },
      get graph() { return null; },
    };
  }
  return { Player: MockPlayer };
});
vi.mock("hls.js", () => ({ default: class MockHls {} }));
vi.mock("@/modules/settings/store/audio", () => ({
  useAudioSettingsStore: () => ({
    isNormalizationEnabled: false,
    normalizationTargetLufs: -14,
    normalizationPreventClipping: true,
    isFadeEnabled: false,
    fadeInDuration: 0,
    fadeOutDuration: 0,
    pushToGraph: vi.fn(),
  }),
}));
vi.mock("@/services/stats.service", () => ({
  statsService: { stopListening: () => Promise.resolve(null), startListening: () => {} },
}));

import { db } from "@/db";
import { downloadSubject } from "../service/enqueue";
import { usePlayerStore } from "@/modules/player/store/player.store";
import type { Track } from "@/modules/player/types";

const dto: SourceTrackDTO = {
  id: ndTrackId("song1"),
  title: "Remote Song",
  artistName: "Artist A",
  albumTitle: "Remote Album",
  albumId: ndAlbumId("album1"),
  artistIds: [ndArtistId("artist1")],
  duration: 240,
};

describe("download → local copy plays → remove → streams (integration)", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));

    storageMock.importFile.mockImplementation((_src: string, target: string) => okAsync(target));
    storageMock.getFileSize.mockReturnValue(okAsync(4096));
    storageMock.getAudioUrl.mockReturnValue(okAsync("blob:local-copy-url"));
    storageMock.deleteFile.mockReturnValue(okAsync(undefined));
    providerMock.downloadToFile.mockReturnValue(okAsync({ path: "C:/tmp/downloads-tmp/song1.flac", format: { codec: "flac" } }));
    providerMock.resolveStreamUrl.mockReturnValue(okAsync("http://127.0.0.1:60123/deadbeef/nd/song/song1"));
    engineMock.importFromItems.mockImplementation(async (items: ImportItem[]) => {
      const successful = [];
      for (const item of items) {
        const known = item.known!;
        const id = TrackId(`local-${known.sourceRef}`);
        await db.tracks.add({
          id,
          title: known.title,
          artistName: known.artistName ?? "",
          albumTitle: known.albumTitle ?? "",
          artistIds: [],
          albumId: AlbumId(""),
          tagIds: [],
          source: TrackSource.LOCAL_INTERNAL,
          pinned: 1,
          state: TrackState.READY,
          storagePath: `tracks/${id}.${item.ext}`,
          duration: 0,
          format: {},
          playCount: 0,
          addedAt: Date.now(),
          sourceRef: known.sourceRef,
        });
        successful.push({ trackId: id, fileName: item.name, title: known.title, artist: "", album: "" });
      }
      return { successful, failed: [], skipped: 0, total: items.length };
    });
  });

  it("plays the imported copy while it exists and falls back to streaming after removal", async () => {
    await downloadSubject({ kind: "remote", dto });
    await vi.waitFor(async () => {
      expect(await db.tracks.where("sourceRef").equals(dto.id).count()).toBe(1);
    });
    // Download = import: the remote row stays a shadow.
    expect((await db.tracks.get(dto.id))?.pinned).toBe(0);

    // Playback prefers the copy: the audio URL comes from storage, not the
    // stream proxy.
    const player = usePlayerStore();
    const track = (await db.tracks.get(dto.id)) as unknown as Track;
    await player.playPlayerTrack({ ...track, kind: "library" });
    expect(storageMock.getAudioUrl).toHaveBeenCalledWith(`tracks/local-${dto.id}.flac`);
    expect(providerMock.resolveStreamUrl).not.toHaveBeenCalled();

    // Removing the copy = deleting the local track; the remote id streams again.
    const { removeLocalCopy } = await import("../service/removeCopy");
    await removeLocalCopy(dto.id);
    expect(await db.tracks.where("sourceRef").equals(dto.id).count()).toBe(0);

    storageMock.getAudioUrl.mockClear();
    await player.playPlayerTrack({ ...track, kind: "library" });
    expect(providerMock.resolveStreamUrl).toHaveBeenCalledWith(dto.id);
    expect(storageMock.getAudioUrl).not.toHaveBeenCalled();
  });
});
