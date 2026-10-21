import { fireEvent, render, screen } from "@testing-library/vue";
import { flushPromises } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import { useDownloadsStore } from "@/modules/downloads/store/downloads.store";
import { dismissFailedDownload, enqueueTrackDownload } from "@/modules/downloads/service/manager";
import type { TrackId } from "@/types/ids";
import DownloadsPanel from "../DownloadsPanel.vue";

vi.mock("@/modules/downloads/service/manager", () => ({
  cancelTrackDownload: vi.fn(),
  enqueueTrackDownload: vi.fn(async () => "job"),
  dismissFailedDownload: vi.fn(async () => {}),
}));
vi.mock("@/queries/track.queries", () => ({
  trackQueries: {
    byIds: (ids: string[]) => ({ queryKey: ["tracks-by-ids", ids], queryFn: async () => ids.map(id => ({ id, title: "Song" })) }),
  },
}));
vi.mock("@/modules/search/composables/useSearch", () => ({
  useSearch: () => ({ openSearch: vi.fn(), requestSearchFocus: vi.fn() }),
}));
vi.mock("@/app/toaster", () => ({ toaster: { add: vi.fn() } }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ error: vi.fn(), warn: vi.fn() }) }));

const renderPanel = () => render(DownloadsPanel, {
  global: {
    plugins: [i18n, [VueQueryPlugin, { queryClient: new QueryClient() }]],
    stubs: { RightPanelHeader: true },
  },
});

describe("DownloadsPanel", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
    vi.clearAllMocks();
    useDownloadsStore().addFailed({ jobId: "j1", trackId: "nd:s1" as TrackId });
  });

  it("lists a download that failed instead of calling the queue empty", async () => {
    renderPanel();
    await flushPromises();

    expect(screen.getByText("Song")).toBeInTheDocument();
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
});
