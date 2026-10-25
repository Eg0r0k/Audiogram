import { render } from "@testing-library/vue";
import { flushPromises } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { createPinia } from "pinia";
import { describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import type { Track } from "@/types/track";
import { localCopyQueries } from "@/queries/localCopy.queries";
import { TrackId } from "@/types/ids";

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

// Infinite staleness keeps a seeded copy from being re-read through Dexie.
const createClient = () => new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });

const renderRow = (track: Track, queryClient: QueryClient) => render(TrackExpanded, {
  props: { track, index: 1 },
  global: {
    plugins: [createPinia(), [VueQueryPlugin, { queryClient }], i18n],
    directives: { ripple: {} },
    stubs: { NuxtImage: true, SourceDownloadButton: true },
  },
});

const downloadedLabel = () => i18n.global.t("downloads.done");

describe("TrackExpanded downloaded mark", () => {
  it("a local library row creates no local-copy query", async () => {
    const queryClient = createClient();

    const { container } = renderRow(localTrack, queryClient);
    await flushPromises();

    expect(queryClient.getQueryCache().findAll({ queryKey: ["tracks", "localCopy"] })).toEqual([]);
    expect(container.querySelector(`[aria-label="${downloadedLabel()}"]`)).toBeNull();
  });

  it("a catalog row shows the downloaded mark when a local copy exists", async () => {
    const queryClient = createClient();
    const copy = { id: TrackId("t-copy"), sourceRef: "nd:s1" } as unknown as TrackEntity;
    queryClient.setQueryData(localCopyQueries.byRemoteId(TrackId("nd:s1")).queryKey, copy);

    const { container } = renderRow(catalogTrack, queryClient);
    await flushPromises();

    const mark = container.querySelector(`[aria-label="${downloadedLabel()}"]`);
    expect(mark).not.toBeNull();
    expect(mark?.getAttribute("title")).toBe(downloadedLabel());
  });
});
