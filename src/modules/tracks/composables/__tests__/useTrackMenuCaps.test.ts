import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, shallowRef, type Ref } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { db } from "@/db";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { trackRepository } from "@/db/repositories";
import { deleteTracksAndSync } from "@/queries/track.queries";
import type { Track } from "@/types/track";
import { AlbumId, TrackId } from "@/types/ids";
import { ytTrackId } from "@/types/track-ref";
import type { TrackMenuSubject } from "../../components/menu/type";

const readCopy = trackRepository.findBySourceRef.bind(trackRepository);
const copyMock = { findBySourceRef: vi.spyOn(trackRepository, "findBySourceRef") };

const registryMock = vi.hoisted(() => ({
  providers: {} as Record<string, { capabilities: { download: boolean } }>,
}));

vi.mock("@/modules/sources", () => ({
  sources: {
    get(kind: string) {
      const provider = registryMock.providers[kind];
      if (!provider) throw new Error(`No source provider registered for "${kind}"`);
      return provider;
    },
  },
}));

import { useTrackMenuCaps, type TrackMenuCaps } from "../useTrackMenuCaps";

function makeLibraryTrack(overrides: Partial<Track> = {}): Track {
  return {
    kind: "library",
    id: TrackId("local-1"),
    title: "Song",
    artist: "Artist",
    artistIds: [],
    albumId: "album-1",
    albumName: "Album",
    storagePath: "tracks/song.mp3",
    source: TrackSource.LOCAL_INTERNAL,
    state: TrackState.READY,
    pinned: 1,
    duration: 100,
    isLiked: false,
    ...overrides,
  } as Track;
}

const mounted: VueWrapper[] = [];

function mountCaps(subject: Ref<TrackMenuSubject | null>) {
  let caps!: Ref<TrackMenuCaps>;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  mounted.push(mount(defineComponent({
    setup() {
      caps = useTrackMenuCaps(subject);
      return () => h("div");
    },
  }), { global: { plugins: [[VueQueryPlugin, { queryClient }]] } }));
  return caps;
}

async function flushQueries() {
  await Promise.resolve();
  await nextTick();
  await new Promise(resolve => setTimeout(resolve, 0));
  await nextTick();
}

const until = async (holds: () => boolean) => {
  for (let i = 0; i < 400 && !holds(); i++) await new Promise(resolve => setTimeout(resolve, 5));
  expect(holds()).toBe(true);
};

const copyRow = (sourceRef: TrackId): TrackEntity => ({
  id: TrackId("local-copy"),
  title: "Song",
  artistName: "Artist",
  albumTitle: "",
  artistIds: [],
  albumId: AlbumId(""),
  tagIds: [],
  source: TrackSource.LOCAL_INTERNAL,
  sourceRef,
  pinned: 1,
  state: TrackState.READY,
  storagePath: "tracks/local-copy.m4a",
  duration: 100,
  format: {},
  playCount: 0,
  addedAt: 1,
});

describe("useTrackMenuCaps", () => {
  afterEach(() => {
    for (const wrapper of mounted.splice(0)) wrapper.unmount();
  });

  it("marks a pinned local library track: exportable, no remote abilities", () => {
    const subject = shallowRef<TrackMenuSubject | null>({ kind: "library", track: makeLibraryTrack() });

    const caps = mountCaps(subject);

    expect(caps.value).toEqual({
      kind: "library",
      source: "local",
      trackId: "local-1",
      isInLibrary: true,
      isPinned: true,
      hasLocalCopy: false,
      canExportFile: true,
      canDownload: false,
      canOpenExternal: false,
    });
    expect(copyMock.findBySourceRef).not.toHaveBeenCalled();
  });

  it("shadow-pinned remote library row is pinned but not in the library", () => {
    copyMock.findBySourceRef.mockResolvedValue(undefined);
    registryMock.providers = { yt: { capabilities: { download: true } } };
    const subject = shallowRef<TrackMenuSubject | null>({
      kind: "library",
      track: makeLibraryTrack({ id: ytTrackId("abc"), storagePath: "", source: TrackSource.REMOTE_YT, pinned: 0 }),
    });

    const caps = mountCaps(subject);

    expect(caps.value.source).toBe("yt");
    expect(caps.value.isPinned).toBe(true);
    expect(caps.value.isInLibrary).toBe(false);
    expect(caps.value.canExportFile).toBe(false);
    expect(caps.value.canDownload).toBe(true);
    expect(caps.value.canOpenExternal).toBe(true);
  });

  it("a downloaded local copy flips canDownload off and canExportFile on", async () => {
    copyMock.findBySourceRef.mockResolvedValue({
      id: TrackId("local-1"),
      storagePath: "tracks/local-1.m4a",
      sourceRef: ytTrackId("abc"),
    } as TrackEntity);
    registryMock.providers = { yt: { capabilities: { download: true } } };
    const subject = shallowRef<TrackMenuSubject | null>({
      kind: "library",
      track: makeLibraryTrack({ id: ytTrackId("abc"), storagePath: "", source: TrackSource.REMOTE_YT }),
    });

    const caps = mountCaps(subject);
    await flushQueries();

    expect(caps.value.hasLocalCopy).toBe(true);
    expect(caps.value.canDownload).toBe(false);
    expect(caps.value.canExportFile).toBe(true);
  });

  it("a remote DTO subject without a copy can be downloaded", () => {
    copyMock.findBySourceRef.mockResolvedValue(undefined);
    registryMock.providers = { yt: { capabilities: { download: true } } };
    const subject = shallowRef<TrackMenuSubject | null>({
      kind: "remote",
      dto: { id: ytTrackId("abc"), title: "Remote song" },
    });

    const caps = mountCaps(subject);

    expect(caps.value).toMatchObject({
      kind: "remote",
      source: "yt",
      trackId: "yt:abc",
      isInLibrary: false,
      isPinned: false,
      canExportFile: false,
      canDownload: true,
      canOpenExternal: true,
    });
  });

  it("tolerates sources without a registered provider (nd until M2)", () => {
    copyMock.findBySourceRef.mockResolvedValue(undefined);
    registryMock.providers = {};
    const subject = shallowRef<TrackMenuSubject | null>({
      kind: "remote",
      dto: { id: TrackId("nd:song1"), title: "ND song" },
    });

    const caps = mountCaps(subject);

    expect(caps.value.source).toBe("nd");
    expect(caps.value.canDownload).toBe(false);
    expect(caps.value.canOpenExternal).toBe(true);
  });

  it("looks up a playing stream's offline copy under its stream identity", async () => {
    copyMock.findBySourceRef.mockResolvedValue(undefined);
    registryMock.providers = { yt: { capabilities: { download: true } }, nd: { capabilities: { download: true } } };
    const ytSubject = shallowRef<TrackMenuSubject | null>({
      kind: "ephemeral",
      track: { kind: "ephemeral", id: "e1", title: "S", source: { type: "url", url: "http://127.0.0.1:60123/deadbeef/yt/abc" } },
    });
    const ndSubject = shallowRef<TrackMenuSubject | null>({
      kind: "ephemeral",
      track: { kind: "ephemeral", id: "e2", title: "N", source: { type: "url", url: "http://127.0.0.1:60123/deadbeef/nd/song/42" } },
    });

    const ytCaps = mountCaps(ytSubject);
    const ndCaps = mountCaps(ndSubject);
    await flushQueries();

    expect(copyMock.findBySourceRef).toHaveBeenCalledWith("yt:abc");
    expect(ytCaps.value).toMatchObject({ kind: "ephemeral", source: "yt", trackId: "yt:abc", canDownload: true, canOpenExternal: true });
    expect(ndCaps.value).toMatchObject({ kind: "ephemeral", source: "nd", trackId: "nd:42" });
  });

  it("classifies a YT ephemeral stream as yt and a path ephemeral as local", () => {
    const ytSubject = shallowRef<TrackMenuSubject | null>({
      kind: "ephemeral",
      track: { kind: "ephemeral", id: "e1", title: "S", source: { type: "url", url: "http://127.0.0.1:60123/deadbeef/yt/abc" } },
    });
    const pathSubject = shallowRef<TrackMenuSubject | null>({
      kind: "ephemeral",
      track: { kind: "ephemeral", id: "e2", title: "F", source: { type: "path", path: "C:/x.mp3" } },
    });

    expect(mountCaps(ytSubject).value.source).toBe("yt");
    expect(mountCaps(pathSubject).value).toMatchObject({
      kind: "ephemeral",
      source: "local",
      trackId: null,
      isPinned: false,
      canExportFile: false,
      canDownload: false,
    });
  });

  it("useTrackMenuCaps: follows the row after a write", async () => {
    copyMock.findBySourceRef.mockImplementation(readCopy);
    registryMock.providers = { yt: { capabilities: { download: true } } };
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    await db.tracks.add(copyRow(ytTrackId("abc")));
    const subject = shallowRef<TrackMenuSubject | null>({
      kind: "remote",
      dto: { id: ytTrackId("abc"), title: "Remote song" },
    });

    const caps = mountCaps(subject);
    await until(() => caps.value.hasLocalCopy);
    expect(caps.value.canDownload).toBe(false);

    await deleteTracksAndSync(new QueryClient(), [TrackId("local-copy")]);

    await until(() => !caps.value.hasLocalCopy);
    expect(caps.value.canDownload).toBe(true);
  });
});
