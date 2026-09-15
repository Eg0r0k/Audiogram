import { beforeEach, describe, expect, it, vi } from "vitest";
import { errAsync, okAsync } from "neverthrow";
import { effectScope } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { createApp } from "vue";
import { TrackSource, TrackState } from "@/db/entities";
import type { Track } from "@/modules/player/types";
import type { SourceProvider } from "@/modules/sources/types";

const toggleTrackLikeAndSync = vi.hoisted(() => vi.fn());
const ensurePinned = vi.hoisted(() => vi.fn());
const invalidateLibraryData = vi.hoisted(() => vi.fn(async () => {}));
const toast = vi.hoisted(() => ({ error: vi.fn() }));
const provider = vi.hoisted(() => ({ setTrackLiked: vi.fn() }));

vi.mock("@/queries/track.queries", () => ({ toggleTrackLikeAndSync }));
vi.mock("@/queries/library.queries", () => ({ invalidateLibraryData }));
vi.mock("@/modules/tracks/service/ensurePinned", () => ({ ensurePinned }));
vi.mock("vue-sonner", () => ({ toast }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/modules/sources", () => ({
  sources: { find: (kind: string) => (kind === "ym" ? provider as unknown as SourceProvider : undefined) },
}));
vi.mock("@/modules/queue/store/queue.store", () => ({
  useQueueStore: () => ({ syncTrackMetadata: vi.fn() }),
}));

import { useToggleTrackLike } from "../useToggleTrackLike";

const remoteRow = (id: string, isLiked = false): Track => ({
  kind: "library",
  id: id as Track["id"],
  title: "Song",
  artist: "Artist",
  artistIds: [],
  albumId: "" as Track["albumId"],
  albumName: "",
  storagePath: "",
  source: TrackSource.REMOTE_YM,
  state: TrackState.READY,
  duration: 200,
  isLiked,
  sourceDto: { id: id as Track["id"], title: "Song" },
});

const localRow = (): Track => ({ ...remoteRow("local-1"), source: TrackSource.LOCAL_INTERNAL, sourceDto: undefined });

/** Runs the composable inside a component setup so vue-query has its client. */
const setup = () => {
  const app = createApp({ render: () => null });
  app.use(VueQueryPlugin, { queryClient: new QueryClient() });
  const scope = effectScope();
  let api!: ReturnType<typeof useToggleTrackLike>;
  app.runWithContext(() => {
    scope.run(() => {
      api = useToggleTrackLike();
    });
  });
  return api;
};

describe("useToggleTrackLike", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    toggleTrackLikeAndSync.mockImplementation(async (_client: unknown, track: Track) => ({ ...track, isLiked: !track.isLiked }));
    ensurePinned.mockImplementation(async (subject: { dto: Track["sourceDto"] }) => remoteRow(subject.dto!.id));
    provider.setTrackLiked.mockReturnValue(okAsync(undefined));
  });

  it("liking a catalog row makes it a library member first, then tells the source, then flips the row", async () => {
    const { toggleTrackLike } = setup();

    const next = await toggleTrackLike(remoteRow("ym:40144"));

    expect(ensurePinned).toHaveBeenCalledWith({ kind: "remote", dto: expect.objectContaining({ id: "ym:40144" }) }, { pinned: 1 });
    expect(provider.setTrackLiked).toHaveBeenCalledWith("ym:40144", true);
    expect(toggleTrackLikeAndSync).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: "ym:40144" }));
    expect(next.isLiked).toBe(true);
    expect(invalidateLibraryData).toHaveBeenCalled();
  });

  it("unliking a catalog row tells the source to forget it and keeps the row where it is", async () => {
    const { toggleTrackLike } = setup();

    await toggleTrackLike(remoteRow("ym:40144", true));

    expect(ensurePinned).toHaveBeenCalledWith(expect.anything(), { pinned: 0 });
    expect(provider.setTrackLiked).toHaveBeenCalledWith("ym:40144", false);
  });

  it("a source that refuses the like leaves the local row untouched and reports", async () => {
    provider.setTrackLiked.mockReturnValue(errAsync({ kind: "NETWORK", message: "offline" }));
    const { toggleTrackLike } = setup();

    await expect(toggleTrackLike(remoteRow("ym:40144"))).rejects.toThrow();

    expect(toggleTrackLikeAndSync).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("track.likeToggleFailed");
  });

  it("a local track is liked without any source or pin involved", async () => {
    const { toggleTrackLike } = setup();

    await toggleTrackLike(localRow());

    expect(ensurePinned).not.toHaveBeenCalled();
    expect(provider.setTrackLiked).not.toHaveBeenCalled();
    expect(toggleTrackLikeAndSync).toHaveBeenCalled();
  });
});
