import { fireEvent, render, screen } from "@testing-library/vue";
import { flushPromises } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";

const folders = vi.hoisted(() => ({ addFolder: vi.fn<() => Promise<string | null>>() }));

vi.mock("../../composables/useWatchedFolders", () => ({
  useWatchedFolders: () => ({
    folders: ref([]),
    autoScanOnStartup: ref(false),
    addFolder: folders.addFolder,
    removeFolder: vi.fn(),
    scanFolder: vi.fn(),
    scanAllFolders: vi.fn(),
    relinkFolder: vi.fn(),
  }),
}));
vi.mock("@/lib/android/folderPicker", () => ({ isAndroidFolderPickerAvailable: () => false }));
vi.mock("@/lib/environment/userAgent", () => ({ IS_TAURI: true, IS_MOBILE: false, IS_WINDOWS: true }));
vi.mock("@/components/dialogs/summonDialog", () => ({ summonDialog: vi.fn() }));

import WatchedFoldersSection from "../WatchedFoldersSection.vue";

const renderSection = () => render(WatchedFoldersSection, {
  global: { plugins: [i18n], directives: { ripple: {} } },
});

const addButton = () => screen.getByText("Add folder").closest("button")!;

describe("WatchedFoldersSection", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
    folders.addFolder.mockReset();
  });

  it("shows why a folder was not added as the add button's description, with a warning icon", async () => {
    folders.addFolder.mockResolvedValue("This folder is already watched");
    renderSection();

    await fireEvent.click(addButton());
    await flushPromises();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("This folder is already watched");
    expect(addButton()).toContainElement(alert);
    expect(alert.querySelector("svg")).not.toBeNull();
  });

  it("clears the reason once the next attempt goes through", async () => {
    folders.addFolder.mockResolvedValueOnce("This folder is already watched").mockResolvedValueOnce(null);
    renderSection();

    await fireEvent.click(addButton());
    await flushPromises();
    await fireEvent.click(addButton());
    await flushPromises();

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
