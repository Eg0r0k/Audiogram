import "fake-indexeddb/auto";
import { fireEvent, render, screen } from "@testing-library/vue";
import { flushPromises } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import { db } from "@/db";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { useDownloadsStore } from "@/modules/downloads/store/downloads.store";
import { dismissFailedDownload, enqueueTrackDownload } from "@/modules/downloads/service/manager";
import { getTracksByIds, updateTrackMetadataAndSync } from "@/queries/track.queries";
import { AlbumId, ArtistId, TrackId } from "@/types/ids";
import DownloadsPanel from "../DownloadsPanel.vue";

vi.mock("@/modules/downloads/service/manager", () => ({
  cancelTrackDownload: vi.fn(),
  enqueueTrackDownload: vi.fn(async () => "job"),
  dismissFailedDownload: vi.fn(async () => {}),
}));
vi.mock("@/modules/search/composables/useSearch", () => ({
  useSearch: () => ({ openSearch: vi.fn(), requestSearchFocus: vi.fn() }),
}));
vi.mock("@/app/toaster", () => ({ toaster: { add: vi.fn() } }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ error: vi.fn(), warn: vi.fn() }) }));

const ROW: TrackEntity = {
  id: TrackId("nd:s1"),
  title: "Song",
  artistName: "Artist",
  albumTitle: "",
  artistIds: [ArtistId("ar1")],
  albumId: AlbumId(""),
  tagIds: [],
  source: TrackSource.REMOTE_SUBSONIC,
  pinned: 0,
  state: TrackState.READY,
  storagePath: "",
  duration: 100,
  format: {},
  playCount: 0,
  addedAt: 1,
};

const renderPanel = () => render(DownloadsPanel, {
  global: {
    plugins: [i18n, [VueQueryPlugin, { queryClient: new QueryClient() }]],
    stubs: { RightPanelHeader: true },
  },
});

describe("DownloadsPanel", () => {
  beforeEach(async () => {
    i18n.global.locale.value = "en";
    vi.clearAllMocks();
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    await db.artists.add({ id: ArtistId("ar1"), name: "Artist", pinned: 1, addedAt: 1, updatedAt: 1 });
    await db.tracks.add(ROW);
    useDownloadsStore().addFailed({ jobId: "j1", trackId: "nd:s1" as TrackId });
  });

  it("lists a download that failed instead of calling the queue empty", async () => {
    renderPanel();

    expect(await screen.findByText("Song")).toBeInTheDocument();
    expect(screen.getByText("Download failed")).toBeInTheDocument();
    expect(screen.queryByText("No active downloads")).toBeNull();
  });

  it("downloads the track again on retry", async () => {
    renderPanel();
    await flushPromises();

    await fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(enqueueTrackDownload).toHaveBeenCalledWith("nd:s1");
  });

  it("drops a failure the user gives up on", async () => {
    renderPanel();
    await flushPromises();

    await fireEvent.click(screen.getByRole("button", { name: "Remove from list" }));

    expect(dismissFailedDownload).toHaveBeenCalledWith("j1");
  });

  it("DownloadsPanel: follows the row after a write", async () => {
    renderPanel();
    expect(await screen.findByText("Song")).toBeInTheDocument();

    const [track] = await getTracksByIds([ROW.id]);
    await updateTrackMetadataAndSync(new QueryClient(), track, { title: "Renamed song", artistNames: ["Artist"] });

    expect(await screen.findByText("Renamed song")).toBeInTheDocument();
    expect(screen.queryByText("Song")).toBeNull();
  });
});
