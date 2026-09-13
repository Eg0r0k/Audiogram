import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/vue";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { nextTick } from "vue";
import LibraryContextMenu from "../LibraryContextMenu.vue";

//
// On mobile the shell is a controlled bottom sheet. The sidebar and the
// search pane each mount their own shell at the same time, so the open
// state must stay per instance: only the shell whose rows were pressed may
// open, or two sheets stack up for one long-press.
//

vi.mock("@/composables/useDeviceLayout", () => ({
  useDeviceLayout: () => ({
    isMobileLayout: { value: true },
    isDesktopLayout: { value: false },
    layoutType: { value: "mobile" },
  }),
}));
vi.mock("@/modules/library/composables/useLibrary", () => ({
  useLibrary: () => ({ togglePin: vi.fn(), createPlaylist: vi.fn(), moveToFolder: vi.fn() }),
}));
vi.mock("@/modules/library/composables/useLibraryContextActions", () => ({
  useLibraryContextActions: () => ({
    addToQueue: vi.fn(),
    addCatalogToQueue: vi.fn(),
    downloadCatalog: vi.fn(),
  }),
}));
vi.mock("@/lib/environment/userAgent", () => ({ IS_TAURI: true, IS_MOBILE: true, IS_WINDOWS: false, IS_CHROMIUM: true, IS_SAFARI: false, IS_MOBILE_SAFARI: false }));

const DrawerStub = {
  props: { open: { type: Boolean, default: false } },
  template: "<div data-sheet :data-open=\"open\"><slot /></div>",
};

const mountTwoShells = () => {
  const i18n = createI18n({
    legacy: false,
    locale: "en",
    messages: { en: {} },
    missingWarn: false,
    fallbackWarn: false,
  });

  render({
    components: { LibraryContextMenu },
    template: `
      <LibraryContextMenu>
        <div data-library-item data-testid="sidebar-row">sidebar</div>
      </LibraryContextMenu>
      <LibraryContextMenu :folder-actions="false">
        <div data-library-item data-testid="search-row">search</div>
      </LibraryContextMenu>
    `,
  }, {
    global: {
      plugins: [createPinia(), VueQueryPlugin, i18n],
      stubs: { Drawer: DrawerStub, DrawerContent: true, ContextMenuCloseBridge: true },
    },
  });
};

const openSheets = () => document.querySelectorAll("[data-sheet][data-open=\"true\"]").length;

const longPress = (el: HTMLElement) => {
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
};

describe("LibraryContextMenu as a sheet", () => {
  it("opens only the shell whose row was pressed", async () => {
    mountTwoShells();

    longPress(screen.getByTestId("search-row"));
    await nextTick();

    expect(openSheets()).toBe(1);
  });
});
