import { describe, expect, it } from "vitest";
import type { LibraryItem } from "../../types";
import { compareLibraryItems, getLibrarySortDirection, getNextLibrarySortKey } from "../librarySort";

const item = (id: string, overrides: Partial<LibraryItem> = {}): LibraryItem => ({
  id,
  type: "album",
  title: id,
  isPinned: false,
  addedAt: 0,
  to: "/",
  rounded: false,
  ...overrides,
});

const ids = (items: LibraryItem[]) => items.map(entry => entry.id);

describe("library sort", () => {
  it("cycles a field through asc, desc and none", () => {
    expect(getNextLibrarySortKey(null, "alphabetical")).toBe("alphabetical_asc");
    expect(getNextLibrarySortKey("alphabetical_asc", "alphabetical")).toBe("alphabetical_desc");
    expect(getNextLibrarySortKey("alphabetical_desc", "alphabetical")).toBeNull();
    expect(getNextLibrarySortKey("recent_desc", "alphabetical")).toBe("alphabetical_asc");
    expect(getNextLibrarySortKey("author_asc", "updated")).toBe("updated_asc");
  });

  it("reports the direction of the active field only", () => {
    expect(getLibrarySortDirection("author_asc", "author")).toBe("asc");
    expect(getLibrarySortDirection("author_desc", "author")).toBe("desc");
    expect(getLibrarySortDirection("author_desc", "alphabetical")).toBeNull();
    expect(getLibrarySortDirection("recent_asc", "updated")).toBeNull();
    expect(getLibrarySortDirection(null, "recent")).toBeNull();
  });

  it("orders newest first when no sort is chosen", () => {
    const items = [item("old", { addedAt: 1 }), item("new", { addedAt: 3 }), item("mid", { addedAt: 2 })];

    expect(ids([...items].sort(compareLibraryItems(null)))).toEqual(["new", "mid", "old"]);
    expect(ids([...items].sort(compareLibraryItems("recent_asc")))).toEqual(["old", "mid", "new"]);
    expect(ids([...items].sort(compareLibraryItems("recent_desc")))).toEqual(["new", "mid", "old"]);
  });

  it("sorts titles both ways and falls back to the title for an item without an author", () => {
    const items = [
      item("b", { title: "Bravo", artistName: "Zulu" }),
      item("a", { title: "Alpha", artistName: "Mike" }),
      item("c", { title: "Charlie" }),
    ];

    expect(ids([...items].sort(compareLibraryItems("alphabetical_asc")))).toEqual(["a", "b", "c"]);
    expect(ids([...items].sort(compareLibraryItems("alphabetical_desc")))).toEqual(["c", "b", "a"]);
    expect(ids([...items].sort(compareLibraryItems("author_asc")))).toEqual(["c", "a", "b"]);
    expect(ids([...items].sort(compareLibraryItems("author_desc")))).toEqual(["b", "a", "c"]);
  });

  it("uses addedAt when an item has no updatedAt", () => {
    const items = [
      item("touched", { addedAt: 1, updatedAt: 10 }),
      item("untouched", { addedAt: 5 }),
      item("stale", { addedAt: 2, updatedAt: 3 }),
    ];

    expect(ids([...items].sort(compareLibraryItems("updated_desc")))).toEqual(["touched", "untouched", "stale"]);
    expect(ids([...items].sort(compareLibraryItems("updated_asc")))).toEqual(["stale", "untouched", "touched"]);
  });
});
