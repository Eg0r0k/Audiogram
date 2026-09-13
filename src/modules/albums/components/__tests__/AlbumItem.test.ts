import { fireEvent, render, screen } from "@testing-library/vue";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import { createPinia } from "pinia";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import type { LibraryItem } from "@/modules/library/types";
import AlbumItem from "../AlbumItem.vue";

const togglePinMock = vi.hoisted(() => vi.fn());
vi.mock("@/modules/library/composables/useLibrary", () => ({
  useLibrary: () => ({ togglePin: togglePinMock }),
}));
vi.mock("@/modules/library/composables/useLibraryMenu", () => ({
  canOpenLibraryMenu: () => true,
  useLibraryMenu: () => ({ openMenu: vi.fn(), activeItem: { value: null }, isContextMenuOpen: { value: false } }),
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

describe("AlbumItem pin button", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
    });
    await router.push("/");
  });

  it("toggles the pin without opening the album", async () => {
    const pushSpy = vi.spyOn(router, "push");
    await renderItem(createItem());

    await fireEvent.click(screen.getByRole("button", { name: "Pin album" }));

    expect(togglePinMock).toHaveBeenCalledWith("album", "a1");
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it("labels the button by the item's kind and pinned state", async () => {
    await renderItem(createItem({ id: "p1", type: "playlist", isPinned: true, to: "/playlist/p1" }));

    const button = screen.getByRole("button", { name: "Unpin playlist" });

    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("has no pin button for catalog items", async () => {
    await renderItem(createItem({ isCatalog: true }));

    expect(screen.queryByRole("button", { name: /pin album/i })).toBeNull();
  });
});
