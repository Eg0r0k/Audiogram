import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { shownToasts } from "@/test/toasts";

vi.mock("@/app/toaster", () => ({ toaster: { add: vi.fn(), remove: vi.fn() } }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("../api/changelogApi", () => ({
  releaseNotesQueryOptions: (tag: string) => ({ queryKey: ["release-notes", tag], queryFn: async () => "## Notes" }),
}));

import { useChangelogStore } from "../store/changelog.store";
import { useChangelogOnStartup } from "../composables/useChangelogOnStartup";

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
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it("announces an update with a toast instead of opening the notes", async () => {
    useChangelogStore().lastSeenVersion = "0.0.1";
    await start();

    expect(announcement()?.actions?.[0]?.label).toBe("update.whatsNewTitle");
    expect(useChangelogStore().isDialogOpen).toBe(false);
  });

  it("opens the notes from the toast", async () => {
    useChangelogStore().lastSeenVersion = "0.0.1";
    await start();

    announcement()?.actions?.[0]?.onClick?.(new MouseEvent("click"));

    expect(useChangelogStore().isDialogOpen).toBe(true);
  });

  it("counts a dismissed toast as seen", async () => {
    useChangelogStore().lastSeenVersion = "0.0.1";
    await start();

    announcement()?.onClose?.();

    expect(useChangelogStore().hasUnseenUpdate).toBe(false);
    expect(useChangelogStore().lastSeenVersion).toBe(__APP_VERSION__);
  });

  it("shows a fresh install no news", async () => {
    await start();

    expect(announcement()).toBeUndefined();
    expect(useChangelogStore().isDialogOpen).toBe(false);
    expect(useChangelogStore().lastSeenVersion).toBe(__APP_VERSION__);
  });
});
