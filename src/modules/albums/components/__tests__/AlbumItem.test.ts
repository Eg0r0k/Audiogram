import { fireEvent, render, screen } from "@testing-library/vue";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import { createPinia } from "pinia";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import type { LibraryItem } from "@/modules/library/types";
import AlbumItem from "../AlbumItem.vue";

const libraryMenu = vi.hoisted(() => ({ openMenu: vi.fn(), isMenuOpenFor: vi.fn(() => false) }));
vi.mock("@/modules/library/composables/useLibraryMenu", () => ({
  useLibraryMenu: () => libraryMenu,
}));
vi.mock("@/modules/player/composables/usePlaybackState", () => ({
  usePlaybackState: () => ({ isActiveSource: ref(false), isPlaying: ref(false), isLoading: ref(false) }),
}));
vi.mock("@/modules/player/store/player.store", () => ({
  usePlayerStore: () => ({ togglePlay: vi.fn() }),
}));

const createItem = (overrides: Partial<LibraryItem> = {}): LibraryItem => ({
  id: "a1",
  type: "album",
  title: "Blue Train",
  subtitle: "John Coltrane",
  isPinned: false,
  addedAt: 0,
  to: "/album/a1",
  rounded: false,
  ...overrides,
});

let router: Router;

const renderItem = async (item: LibraryItem) => {
  const utils = render(AlbumItem, {
    props: { item },
    global: {
      plugins: [createPinia(), i18n, router],
      stubs: { EntityCoverImage: true },
      directives: { ripple: {} },
    },
  });
  await router.isReady();
  return utils;
};

describe("AlbumItem pin mark", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
    });
    await router.push("/");
  });

  it("marks a pinned item next to its title", async () => {
    await renderItem(createItem({ isPinned: true }));

    const mark = screen.getByRole("img", { name: "Pinned" });

    expect(mark.parentElement!.textContent).toContain("Blue Train");
  });

  it("shows no mark for an unpinned item", async () => {
    await renderItem(createItem());

    expect(screen.queryByRole("img", { name: "Pinned" })).toBeNull();
  });

  it("has no pin button: pinning lives in the context menu", async () => {
    await renderItem(createItem({ isPinned: true }));

    expect(screen.queryByRole("button", { name: /^(un)?pin /i })).toBeNull();
  });
});

describe("AlbumItem context menu", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    libraryMenu.isMenuOpenFor.mockReturnValue(false);
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
    });
    await router.push("/");
  });

  it("hands its item and the right-click to the enclosing library menu", async () => {
    const item = createItem();
    const { container } = await renderItem(item);

    await fireEvent.contextMenu(container.querySelector("[role=button]")!);

    expect(libraryMenu.openMenu).toHaveBeenCalledWith(item, expect.any(MouseEvent));
  });

  it("keeps the hover look while the menu is up for it", async () => {
    libraryMenu.isMenuOpenFor.mockReturnValue(true);
    const { container } = await renderItem(createItem());

    expect(container.querySelector("[role=button]")!.hasAttribute("data-menu-open")).toBe(true);
  });
});
