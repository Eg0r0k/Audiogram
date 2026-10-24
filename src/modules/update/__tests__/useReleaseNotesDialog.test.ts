import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { onlineManager, QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { createPinia, setActivePinia } from "pinia";
import { changelogKeys } from "../api/changelogApi";
import { useChangelogStore } from "../store/changelog.store";
import { useReleaseNotesDialog } from "../composables/useReleaseNotesDialog";

const TAG = `v${__APP_VERSION__}`;
const REPO = import.meta.env.VITE_GITHUB_REPO as string;
const API_RELEASE_URL = "https://github.com/owner/app/releases/tag/from-api";
const OLD_EMPTY_NOTES = "Release notes have not been published for this version yet.";

const respond = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { "Content-Type": "application/json" },
});

const githubRelease = (body: string | null) => respond({
  tag_name: TAG,
  body,
  prerelease: false,
  published_at: "2026-10-24T09:30:00Z",
  html_url: API_RELEASE_URL,
});

const serverError = () => respond({ message: "Server Error" }, 500);

const fetchMock = vi.fn<typeof fetch>();

let queryClient: QueryClient;
let wrapper: VueWrapper | undefined;
let dialog: ReturnType<typeof useReleaseNotesDialog>;

const mountDialog = () => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  wrapper = mount(defineComponent({
    setup() {
      dialog = useReleaseNotesDialog();
      return () => h("div");
    },
  }), { global: { plugins: [[VueQueryPlugin, { queryClient }]] } });
};

const releaseRequestStatus = () => queryClient.getQueryState(changelogKeys.byTag(TAG))?.status;

describe("useReleaseNotesDialog", () => {
  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    queryClient.clear();
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
  });

  it("opens the dialog at once and loads the release there", async () => {
    fetchMock.mockImplementation(async () => githubRelease("## New features\n- **Queue** - drag to reorder"));
    mountDialog();
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalled();

    useChangelogStore().openDialog();

    expect(useChangelogStore().isDialogOpen).toBe(true);
    expect(dialog.status.value).toBe("loading");
    expect(dialog.version.value).toBe(__APP_VERSION__);

    await vi.waitFor(() => expect(dialog.status.value).toBe("ready"));
    expect(dialog.body.value).toBe("## New features\n- **Queue** - drag to reorder");
    expect(dialog.publishedAt.value).toEqual(new Date("2026-10-24T09:30:00Z"));
    expect(dialog.releaseUrl.value).toBe(API_RELEASE_URL);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows the stored notes without a date when the release request fails", async () => {
    fetchMock.mockImplementation(async () => serverError());
    useChangelogStore().setPendingChangelog(__APP_VERSION__, "## Fixes\n- Stored offline");
    mountDialog();

    useChangelogStore().openDialog();

    expect(dialog.status.value).toBe("ready");
    expect(dialog.body.value).toBe("## Fixes\n- Stored offline");
    await vi.waitFor(() => expect(releaseRequestStatus()).toBe("error"));
    expect(dialog.status.value).toBe("ready");
    expect(dialog.body.value).toBe("## Fixes\n- Stored offline");
    expect(dialog.publishedAt.value).toBeNull();
    expect(dialog.releaseUrl.value).toBe(`https://github.com/${REPO}/releases/tag/${TAG}`);
  });

  it("reports no notes for an empty body and for the old sentinel", async () => {
    fetchMock.mockImplementation(async () => githubRelease("   "));
    mountDialog();
    useChangelogStore().openDialog();

    await vi.waitFor(() => expect(dialog.status.value).toBe("empty"));
    expect(dialog.body.value).toBe("");

    wrapper?.unmount();
    queryClient.clear();
    setActivePinia(createPinia());
    localStorage.setItem("audiogram:pendingVersion", __APP_VERSION__);
    localStorage.setItem("audiogram:pendingChangelog", OLD_EMPTY_NOTES);
    fetchMock.mockImplementation(async () => serverError());
    mountDialog();

    useChangelogStore().openDialog();

    expect(dialog.status.value).toBe("empty");
    expect(dialog.body.value).toBe("");
  });

  it("reports no notes when the release is not published yet", async () => {
    fetchMock.mockImplementation(async () => respond({ message: "Not Found" }, 404));
    mountDialog();

    useChangelogStore().openDialog();

    await vi.waitFor(() => expect(dialog.status.value).toBe("empty"));
    expect(dialog.releasesUrl).toBe(`https://github.com/${REPO}/releases`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports an error when nothing is stored and the request fails", async () => {
    fetchMock.mockImplementation(async () => serverError());
    mountDialog();

    useChangelogStore().openDialog();

    expect(dialog.status.value).toBe("loading");
    await vi.waitFor(() => expect(dialog.status.value).toBe("error"));
    expect(dialog.body.value).toBe("");
    expect(dialog.publishedAt.value).toBeNull();
    expect(dialog.releaseUrl.value).toBe(`https://github.com/${REPO}/releases/tag/${TAG}`);
    expect(dialog.releasesUrl).toBe(`https://github.com/${REPO}/releases`);
  });

  it("reports an error while offline with nothing stored", async () => {
    onlineManager.setOnline(false);
    fetchMock.mockImplementation(async () => githubRelease("## Notes"));
    mountDialog();

    useChangelogStore().openDialog();

    await vi.waitFor(() => expect(dialog.status.value).toBe("error"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries the request", async () => {
    fetchMock.mockImplementation(async () => serverError());
    mountDialog();
    useChangelogStore().openDialog();
    await vi.waitFor(() => expect(dialog.status.value).toBe("error"));

    fetchMock.mockImplementation(async () => githubRelease("## Improvements\n- Faster start"));
    dialog.retry();

    expect(dialog.status.value).toBe("loading");
    await vi.waitFor(() => expect(dialog.status.value).toBe("ready"));
    expect(dialog.body.value).toBe("## Improvements\n- Faster start");
  });

  it("keeps showing the notes while the dialog closes", async () => {
    fetchMock.mockImplementation(async () => serverError());
    useChangelogStore().setPendingChangelog(__APP_VERSION__, "## Fixes\n- Stored");
    mountDialog();
    useChangelogStore().openDialog();
    await vi.waitFor(() => expect(releaseRequestStatus()).toBe("error"));

    useChangelogStore().closeDialog();

    expect(useChangelogStore().pendingChangelog).toBeNull();
    expect(dialog.status.value).toBe("ready");
    expect(dialog.body.value).toBe("## Fixes\n- Stored");
  });
});
