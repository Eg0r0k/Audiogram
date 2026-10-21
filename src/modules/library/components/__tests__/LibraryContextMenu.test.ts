import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { defineComponent, h, nextTick, type PropType } from "vue";
import type { LibraryItem } from "@/modules/library/types";
import { useLibraryMenu } from "@/modules/library/composables/useLibraryMenu";
import LibraryContextMenu from "../LibraryContextMenu.vue";

//
// The shell opens only when a row inside it asks: the row hands over its item
// and the right-click, the shell decides and places the popper. A row with
// nothing to show never opens anything and still swallows the click, so no
// enclosing menu (the page's track menu) opens on it instead.
//

vi.mock("@/composables/useDeviceLayout", () => ({
  useDeviceLayout: () => ({
    isMobileLayout: { value: false },
    isDesktopLayout: { value: true },
    layoutType: { value: "desktop" },
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
vi.mock("@/lib/environment/userAgent", () => ({ IS_TAURI: true, IS_MOBILE: false, IS_WINDOWS: false, IS_CHROMIUM: true, IS_SAFARI: false, IS_MOBILE_SAFARI: false }));

const popper = vi.hoisted(() => ({ show: vi.fn() }));
vi.mock("@/components/ui/menu", async (importOriginal) => {
  const { defineComponent: define } = await import("vue");
  // The real parts need a reka MenuRoot the stubbed surface does not provide.
  const Part = define({ inheritAttrs: false, template: "<div><slot /></div>" });
  return {
    ...(await importOriginal<typeof import("@/components/ui/menu")>()),
    MenuItem: Part,
    MenuSeparator: Part,
    MenuLabel: Part,
    MenuGroup: Part,
    MenuSub: Part,
    MenuSubTrigger: Part,
    MenuSubContent: Part,
    MenuRadioGroup: Part,
    MenuRadioItem: Part,
    MenuCheckboxItem: Part,
    Menu: define({
      name: "MenuStub",
      props: { modelValue: { type: Boolean, default: false } },
      emits: ["update:modelValue"],
      setup(_props, { emit, expose }) {
        expose({
          show: (event?: Event) => {
            popper.show(event);
            emit("update:modelValue", true);
          },
          hide: () => emit("update:modelValue", false),
        });
      },
      template: "<div data-menu :data-open=\"modelValue\"><slot /></div>",
    }),
  };
});

const Row = defineComponent({
  props: {
    item: { type: Object as PropType<LibraryItem>, required: true },
    testid: { type: String, required: true },
  },
  setup() {
    return { menu: useLibraryMenu() };
  },
  template: `
    <div
      :data-testid="testid"
      :data-menu-open="menu.isMenuOpenFor(item) || undefined"
      @contextmenu="menu.openMenu(item, $event)"
    >row</div>
  `,
});

const item = (overrides: Partial<LibraryItem>): LibraryItem => ({
  id: "a1",
  type: "album",
  title: "Row",
  isPinned: false,
  addedAt: 0,
  to: "/",
  rounded: false,
  ...overrides,
});

const album = item({ id: "a1", type: "album" });
const catalogArtist = item({ id: "nd:artist1", type: "artist", isCatalog: true });

const mountShell = () => {
  const i18n = createI18n({
    legacy: false,
    locale: "en",
    messages: { en: {} },
    missingWarn: false,
    fallbackWarn: false,
  });

  return mount(LibraryContextMenu, {
    global: { plugins: [createPinia(), VueQueryPlugin, i18n] },
    slots: {
      default: () => [
        h(Row, { item: album, testid: "album" }),
        h(Row, { item: catalogArtist, testid: "catalog-artist" }),
      ],
    },
  });
};

const rightClick = (el: Element) => {
  const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
};

describe("LibraryContextMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens the popper at the row's right-click and marks the row", async () => {
    const wrapper = mountShell();
    const row = wrapper.get("[data-testid=album]");

    const event = rightClick(row.element);
    await nextTick();

    expect(popper.show).toHaveBeenCalledWith(event);
    expect(event.defaultPrevented).toBe(true);
    expect(row.attributes("data-menu-open")).toBe("true");
  });

  it("renders the actions of the row that opened it", async () => {
    const wrapper = mountShell();

    rightClick(wrapper.get("[data-testid=album]").element);
    await nextTick();

    expect(wrapper.get("[data-menu]").text()).toContain("track.contextMenu.addToQueue");
  });

  it("swallows the right-click of a row with nothing to show", async () => {
    const wrapper = mountShell();

    const event = rightClick(wrapper.get("[data-testid=catalog-artist]").element);
    await nextTick();

    expect(popper.show).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
    expect(wrapper.get("[data-testid=catalog-artist]").attributes("data-menu-open")).toBeUndefined();
  });

  it("unmarks the row once the popper closes", async () => {
    const wrapper = mountShell();
    const row = wrapper.get("[data-testid=album]");
    rightClick(row.element);
    await nextTick();

    wrapper.findComponent({ name: "MenuStub" }).vm.$emit("update:modelValue", false);
    // A popper close reaches the consumer one macrotask later (see useResponsiveMenuRoot).
    await new Promise(resolve => setTimeout(resolve, 0));
    await nextTick();

    expect(row.attributes("data-menu-open")).toBeUndefined();
  });

  it("ignores a right-click that no row reported", async () => {
    const wrapper = mountShell();

    const event = rightClick(wrapper.element);
    await nextTick();

    expect(popper.show).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
