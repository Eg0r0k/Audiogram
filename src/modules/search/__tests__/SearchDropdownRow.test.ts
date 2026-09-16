import { render } from "@testing-library/vue";
import { describe, expect, it, vi } from "vitest";
import type { LibraryItem } from "@/modules/library/types";
import type { SearchResultItem } from "@/modules/search/types";
import SearchDropdownRow from "../components/SearchDropdownRow.vue";

//
// Строки результатов источника — строки его каталога: без isCatalog
// библиотечное меню идёт в Dexie за теневой строкой и открывается пустым,
// а ссылка теряет catalog-intent, который SourceSearchPane считает.
//

vi.mock("@/modules/sources/lib/display", () => ({
  sourceKindOf: (id: string) => (id.startsWith("ym:") ? "ym" : "local"),
}));

const seen: LibraryItem[] = [];

const stubs = {
  LibrarySidebarItem: {
    props: ["item"],
    setup(props: { item: LibraryItem }) {
      seen.push(props.item);
      return () => null;
    },
  },
  TrackRow: true,
  TrackContextMenu: { template: "<div data-track-menu-scope><slot /></div>" },
  TrackDropdown: true,
};

const entity = (type: SearchResultItem["type"], entityId: string): SearchResultItem => ({
  id: entityId,
  type,
  title: entityId,
  entityId,
  score: 1,
});

const renderRow = (item: SearchResultItem) => {
  seen.length = 0;
  render(SearchDropdownRow, { props: { item }, global: { stubs } });
  return seen[0]!;
};

describe("SearchDropdownRow", () => {
  it("marks a source's entity as a catalog row and links into the catalog view", () => {
    const row = renderRow(entity("artist", "ym:41075"));

    expect(row.isCatalog).toBe(true);
    expect(row.to).toMatchObject({ query: { catalog: "1" } });
  });

  it("keeps a library entity as a library row with a plain link", () => {
    const row = renderRow(entity("album", "local-uuid"));

    expect(row.isCatalog).toBe(false);
    expect(row.to).not.toHaveProperty("query");
  });

  it("renders the best-result track inside its own track-menu scope", () => {
    const track = { id: "local-t1", title: "T", artistName: "A", duration: 1 } as never;
    const { container } = render(SearchDropdownRow, {
      props: { item: entity("track", "local-t1"), track },
      global: { stubs },
    });

    const scope = container.querySelector("[data-track-menu-scope]");
    expect(scope).not.toBeNull();
    expect(scope!.querySelector("track-row-stub")).not.toBeNull();
  });
});
