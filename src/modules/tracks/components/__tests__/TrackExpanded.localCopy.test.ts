import "fake-indexeddb/auto";
import { render, waitFor } from "@testing-library/vue";
import { flushPromises } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { createPinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import { db } from "@/db";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { trackRepository } from "@/db/repositories";
import { deleteTracksAndSync } from "@/queries/track.queries";
import type { Track } from "@/types/track";
import { AlbumId, TrackId } from "@/types/ids";

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({}),
}));
vi.mock("@/modules/tracks/composables/useTrackMenu", () => ({
  useTrackMenu: () => ({ openDropdown: vi.fn(), isMenuOpenFor: () => false }),
}));
vi.mock("@/modules/tracks/composables/useToggleTrackLike", () => ({
  useToggleTrackLike: () => ({ toggleTrackLike: vi.fn() }),
}));
vi.mock("@/modules/tracks/composables/useTrackRowCover", async () => {
  const { shallowRef } = await import("vue");
  return { useTrackRowCover: () => shallowRef("/img/fallback.svg") };
});

import TrackExpanded from "../TrackExpanded.vue";

const localTrack: Track = {
  kind: "library",
  id: TrackId("t1"),
  title: "Song",
  artist: "Artist One",
  artistIds: [],
  albumId: "a1" as Track["albumId"],
  albumName: "Album One",
  storagePath: "tracks/t1.mp3",
  source: TrackSource.LOCAL_INTERNAL,
  state: TrackState.READY,
  duration: 100,
  isLiked: false,
};

const catalogTrack: Track = {
  ...localTrack,
  id: TrackId("nd:s1"),
  storagePath: "",
  source: TrackSource.REMOTE_SUBSONIC,
  sourceDto: { id: TrackId("nd:s1"), title: "Song" },
};

const COPY: TrackEntity = {
  id: TrackId("t-copy"),
  title: "Song",
  artistName: "Artist One",
  albumTitle: "",
  artistIds: [],
  albumId: AlbumId(""),
  tagIds: [],
  source: TrackSource.LOCAL_INTERNAL,
  sourceRef: TrackId("nd:s1"),
  pinned: 1,
  state: TrackState.READY,
  storagePath: "tracks/t-copy.flac",
  duration: 100,
  format: {},
  playCount: 0,
  addedAt: 1,
};

const renderRow = (track: Track) => render(TrackExpanded, {
  props: { track, index: 1 },
  global: {
    plugins: [createPinia(), [VueQueryPlugin, { queryClient: new QueryClient() }], i18n],
    directives: { ripple: {} },
    stubs: { NuxtImage: true, SourceDownloadButton: true },
  },
});

const downloadedLabel = () => i18n.global.t("downloads.done");
const markOf = (container: Element) => container.querySelector(`[aria-label="${downloadedLabel()}"]`);

describe("TrackExpanded downloaded mark", () => {
  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("a local library row creates no local-copy query", async () => {
    const lookup = vi.spyOn(trackRepository, "findBySourceRef");

    const { container } = renderRow(localTrack);
    await flushPromises();

    expect(lookup).not.toHaveBeenCalled();
    expect(markOf(container)).toBeNull();
  });

  it("a catalog row shows the downloaded mark when a local copy exists", async () => {
    await db.tracks.add(COPY);

    const { container } = renderRow(catalogTrack);

    await waitFor(() => expect(markOf(container)).not.toBeNull());
    expect(markOf(container)?.getAttribute("title")).toBe(downloadedLabel());
  });

  it("DownloadedMark: follows the row after a write", async () => {
    await db.tracks.add(COPY);
    const { container } = renderRow(catalogTrack);
    await waitFor(() => expect(markOf(container)).not.toBeNull());

    await deleteTracksAndSync([COPY.id]);

    await waitFor(() => expect(markOf(container)).toBeNull());
  });
});
