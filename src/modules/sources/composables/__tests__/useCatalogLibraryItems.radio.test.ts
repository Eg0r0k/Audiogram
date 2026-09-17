import { beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import type { LibraryFilter } from "@/modules/library/types";
import type { SourceKind } from "@/types/track-ref";

const emptyQuery = () => ({ data: ref([]), isLoading: ref(false), isFetchingNextPage: ref(false), hasNextPage: ref(false), fetchNextPage: vi.fn() });
vi.mock("../useSourceCatalog", () => ({
  useSourceArtists: () => emptyQuery(),
  useSourcePlaylists: () => emptyQuery(),
  useSourceAlbumsInfinite: () => ({ ...emptyQuery(), data: ref({ pages: [] }) }),
}));
vi.mock("@/lib/environment/userAgent", () => ({ IS_TAURI: true, IS_MOBILE: false, IS_WINDOWS: true }));

import { useCatalogLibraryItems } from "../useCatalogLibraryItems";

const itemsFor = (kind: SourceKind, filter: LibraryFilter) => {
  const scope = effectScope();
  const items = scope.run(() => useCatalogLibraryItems(kind, filter).items.value)!;
  scope.stop();
  return items;
};

describe("useCatalogLibraryItems — the station card", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("leads the Yandex catalog with My Wave on the mixed and playlist tabs", () => {
    for (const filter of ["all", "playlist"] as const) {
      const [first] = itemsFor("ym", filter);
      expect(first).toMatchObject({
        type: "radio",
        id: "user:onyourwave",
        title: "My Wave",
        isCatalog: true,
        isSystem: true,
        rounded: false,
      });
    }
  });

  it("keeps the station off the artist and album tabs", () => {
    expect(itemsFor("ym", "artist")).toEqual([]);
    expect(itemsFor("ym", "album")).toEqual([]);
  });

  it("offers no station for a source without one", () => {
    expect(itemsFor("nd", "all")).toEqual([]);
  });
});
