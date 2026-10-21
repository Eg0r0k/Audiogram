import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import type { LibraryItem } from "@/modules/library/types";
import { getAlbumLibraryRow } from "@/queries/album.queries";
import { getArtistLibraryRow } from "@/queries/artist.queries";
import {
  createLibraryMenu,
  type LibraryMenuHandle,
  provideLibraryMenu,
  useLibraryMenu,
} from "../useLibraryMenu";

vi.mock("@/queries/album.queries", () => ({ getAlbumLibraryRow: vi.fn() }));
vi.mock("@/queries/artist.queries", () => ({ getArtistLibraryRow: vi.fn() }));
vi.mock("@/queries/playlist.queries", () => ({ getPlaylistLibraryRow: vi.fn() }));

const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }));
vi.mock("@/lib/logger", () => ({ getLogger: () => logger }));

function item(id: string, type: LibraryItem["type"], isCatalog = false): LibraryItem {
  return {
    id, type, title: "T", isPinned: true, addedAt: 1, to: "/", rounded: false, isCatalog,
  };
}

const rightClick = () => new MouseEvent("contextmenu", { bubbles: true, cancelable: true });

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("createLibraryMenu", () => {
  let show: ReturnType<typeof vi.fn>;
  let menu: ReturnType<typeof createLibraryMenu>;

  beforeEach(() => {
    vi.clearAllMocks();
    show = vi.fn();
    menu = createLibraryMenu(show);
  });

  it("opens a local row at once with the library actions", () => {
    const event = rightClick();

    menu.openMenu(item("local-uuid", "album"), event);

    expect(show).toHaveBeenCalledWith(event);
    expect(menu.activeItem.value?.id).toBe("local-uuid");
    expect(menu.menuFlavor.value).toBe("library");
  });

  //
  // The shadow-row decision is async, and by the time it lands the event has
  // long bubbled on: whatever the outcome, the right-click is this menu's
  // the moment the row reports it, or an enclosing menu takes it meanwhile.
  //
  it("takes the right-click before deciding", () => {
    vi.mocked(getAlbumLibraryRow).mockResolvedValue(null);
    const event = rightClick();
    const stop = vi.spyOn(event, "stopPropagation");

    menu.openMenu(item("yt:MPREb_1", "album"), event);

    expect(event.defaultPrevented).toBe(true);
    expect(stop).toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
  });

  it("opens a remote-prefixed album once its shadow row is found", async () => {
    vi.mocked(getAlbumLibraryRow).mockResolvedValue({ id: "yt:MPREb_1" } as never);
    const event = rightClick();

    menu.openMenu(item("yt:MPREb_1", "album"), event);
    await flush();

    expect(show).toHaveBeenCalledWith(event);
    expect(menu.activeItem.value?.id).toBe("yt:MPREb_1");
    expect(menu.menuFlavor.value).toBe("library");
  });

  it("stays closed for a remote artist without a library row (catalog browsing)", async () => {
    vi.mocked(getArtistLibraryRow).mockResolvedValue(null);

    menu.openMenu(item("nd:artist9", "artist"), rightClick());
    await flush();

    expect(show).not.toHaveBeenCalled();
    expect(menu.activeItem.value).toBeNull();
  });

  it("logs a failed lookup and stays closed", async () => {
    vi.mocked(getArtistLibraryRow).mockRejectedValue(new Error("idb gone"));

    menu.openMenu(item("nd:artist9", "artist"), rightClick());
    await flush();

    expect(show).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("idb gone"));
  });

  //
  // ND browsing: catalog rows have no DB row, so the library flavor would
  // render an empty popup. Albums/playlists get the catalog flavor (queue +
  // download); an artist has nothing actionable and must not open at all.
  //
  it("opens a catalog album with the catalog actions, without touching the DB", () => {
    const event = rightClick();

    menu.openMenu(item("nd:album1", "album", true), event);

    expect(show).toHaveBeenCalledWith(event);
    expect(menu.activeItem.value?.id).toBe("nd:album1");
    expect(menu.menuFlavor.value).toBe("catalog");
    expect(getAlbumLibraryRow).not.toHaveBeenCalled();
  });

  it("never opens for a catalog artist, yet swallows the right-click", () => {
    const event = rightClick();

    menu.openMenu(item("nd:artist1", "artist", true), event);

    expect(show).not.toHaveBeenCalled();
    expect(menu.activeItem.value).toBeNull();
    expect(event.defaultPrevented).toBe(true);
  });

  it("reports the menu open only for the active row, and only while open", () => {
    menu.openMenu(item("local-uuid", "album"), rightClick());
    expect(menu.isMenuOpenFor({ id: "local-uuid", type: "album" })).toBe(false);

    menu.isOpen.value = true;
    expect(menu.isMenuOpenFor({ id: "local-uuid", type: "album" })).toBe(true);
    expect(menu.isMenuOpenFor({ id: "local-uuid", type: "playlist" })).toBe(false);
    expect(menu.isMenuOpenFor({ id: "other", type: "album" })).toBe(false);

    menu.isOpen.value = false;
    expect(menu.isMenuOpenFor({ id: "local-uuid", type: "album" })).toBe(false);
  });

  it("keeps the active row through a close, so the content outlives the exit animation", () => {
    menu.openMenu(item("local-uuid", "album"), rightClick());
    menu.isOpen.value = true;

    menu.isOpen.value = false;

    expect(menu.activeItem.value?.id).toBe("local-uuid");
  });
});

describe("useLibraryMenu", () => {
  const captureFrom = (setup: () => void) => {
    let handle: LibraryMenuHandle | undefined;
    const Row = defineComponent({
      setup() {
        handle = useLibraryMenu();
        return () => h("div");
      },
    });
    mount(defineComponent({
      setup() {
        setup();
        return () => h(Row);
      },
    }));
    return handle!;
  };

  it("hands a row the menu of the shell it sits in", () => {
    const menu = createLibraryMenu(vi.fn());

    const handle = captureFrom(() => provideLibraryMenu(menu));

    expect(handle.openMenu).toBe(menu.openMenu);
    expect(handle.isMenuOpenFor).toBe(menu.isMenuOpenFor);
  });

  it("gives a row outside any shell an inert menu that leaves the right-click alone", () => {
    const handle = captureFrom(() => {});
    const event = rightClick();

    handle.openMenu(item("local-uuid", "album"), event);

    expect(handle.isMenuOpenFor({ id: "local-uuid", type: "album" })).toBe(false);
    expect(event.defaultPrevented).toBe(false);
  });
});
