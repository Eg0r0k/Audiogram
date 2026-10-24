import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { shownToasts } from "@/test/toasts";

vi.mock("@/app/toaster", () => ({ toaster: { add: vi.fn(), remove: vi.fn() } }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

import { useChangelogStore } from "../store/changelog.store";
import { useChangelogOnStartup } from "../composables/useChangelogOnStartup";

const githubRelease = (body: string | null) => new Response(JSON.stringify({
  tag_name: `v${__APP_VERSION__}`,
  body,
  prerelease: false,
  published_at: "2026-10-24T09:30:00Z",
  html_url: "https://github.com/owner/app/releases/tag/v1",
}), { status: 200, headers: { "Content-Type": "application/json" } });

const fetchMock = vi.fn<typeof fetch>();

let wrapper: VueWrapper | undefined;

const start = async () => {
  wrapper = mount(defineComponent({
    setup() {
      useChangelogOnStartup();
      return () => h("div");
    },
  }), { global: { plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]] } });
  await flushPromises();
};

const announcement = () => shownToasts().find(toast => toast.title === "update.updatedTo");

describe("useChangelogOnStartup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    fetchMock.mockReset().mockImplementation(async () => githubRelease("## Notes"));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.unstubAllGlobals();
  });

  it("announces an update with a toast instead of opening the notes", async () => {
    useChangelogStore().lastSeenVersion = "0.0.1";
    await start();

    await vi.waitFor(() => expect(announcement()?.actions?.[0]?.label).toBe("update.whatsNewTitle"));
    expect(useChangelogStore().isDialogOpen).toBe(false);
  });

  it("opens the notes from the toast", async () => {
    useChangelogStore().lastSeenVersion = "0.0.1";
    await start();
    await vi.waitFor(() => expect(announcement()).toBeDefined());

    announcement()?.actions?.[0]?.onClick?.(new MouseEvent("click"));

    expect(useChangelogStore().isDialogOpen).toBe(true);
    expect(useChangelogStore().activeVersion).toBe(__APP_VERSION__);
    expect(useChangelogStore().activeChangelog).toBe("## Notes");
  });

  it("counts a dismissed toast as seen", async () => {
    useChangelogStore().lastSeenVersion = "0.0.1";
    await start();
    await vi.waitFor(() => expect(announcement()).toBeDefined());

    announcement()?.onClose?.();

    expect(useChangelogStore().hasUnseenUpdate).toBe(false);
    expect(useChangelogStore().lastSeenVersion).toBe(__APP_VERSION__);
  });

  it("shows a fresh install no news", async () => {
    await start();

    expect(announcement()).toBeUndefined();
    expect(useChangelogStore().isDialogOpen).toBe(false);
    expect(useChangelogStore().lastSeenVersion).toBe(__APP_VERSION__);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stores the fetched notes so the dialog has them at once", async () => {
    useChangelogStore().lastSeenVersion = "0.0.1";
    await start();

    await vi.waitFor(() => expect(useChangelogStore().pendingChangelog).toBe("## Notes"));
    expect(useChangelogStore().pendingVersion).toBe(__APP_VERSION__);
  });

  it("stores empty notes as empty, not as a placeholder text", async () => {
    fetchMock.mockImplementation(async () => githubRelease(null));
    useChangelogStore().lastSeenVersion = "0.0.1";
    await start();

    await vi.waitFor(() => expect(announcement()).toBeDefined());
    expect(useChangelogStore().pendingChangelog).toBe("");
  });

  it("announces staged empty notes without asking the network", async () => {
    localStorage.setItem("audiogram:lastSeenVersion", "0.0.1");
    localStorage.setItem("audiogram:stagedVersion", __APP_VERSION__);
    localStorage.setItem("audiogram:stagedChangelog", "");
    await start();

    expect(announcement()).toBeDefined();
    expect(useChangelogStore().pendingChangelog).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
