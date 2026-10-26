import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computed, effectScope, ref, shallowRef, type EffectScope } from "vue";
import { QueryClient } from "@tanstack/vue-query";
import { db } from "@/db";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { getTracksByIds, updateTrackMetadataAndSync } from "@/queries/track.queries";
import type { SearchEntityType, SearchResultItem } from "@/services/search/types";
import { AlbumId, ArtistId, TrackId } from "@/types/ids";

const groupsOf = (trackIds: string[]): Record<SearchEntityType, SearchResultItem[]> => ({
  track: trackIds.map(id => ({ type: "track", entityId: id }) as SearchResultItem),
  artist: [],
  album: [],
  playlist: [],
});

const searchState = {
  query: ref("song"),
  submittedQuery: ref(""),
  isSubmitMode: ref(false),
  isSearching: ref(false),
  hasQuery: ref(true),
  results: shallowRef({ groups: groupsOf([]), topResults: [] as SearchResultItem[] }),
};

vi.mock("../useSearch", () => ({ useSearch: () => searchState }));
vi.mock("@/modules/sources/composables/useSourceCatalog", () => ({
  useSourceSearch: () => ({ data: ref(undefined), isLoading: ref(false) }),
  useSourcePlaylists: () => ({ data: ref(undefined) }),
}));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

import { useSearchPaneResults } from "../useSearchPaneResults";

const row = (id: string, title: string): TrackEntity => ({
  id: TrackId(id),
  title,
  artistName: "Artist",
  albumTitle: "",
  artistIds: [ArtistId("ar1")],
  albumId: AlbumId(""),
  tagIds: [],
  source: TrackSource.LOCAL_INTERNAL,
  pinned: 1,
  state: TrackState.READY,
  storagePath: `tracks/${id}.mp3`,
  duration: 100,
  format: {},
  playCount: 0,
  addedAt: 1,
});

const until = async (holds: () => boolean) => {
  for (let i = 0; i < 400 && !holds(); i++) await new Promise(resolve => setTimeout(resolve, 5));
  expect(holds()).toBe(true);
};

describe("useSearchPaneResults", () => {
  let scope: EffectScope;

  const start = () => scope.run(() => useSearchPaneResults(computed(() => "local")))!;
  const titles = (api: ReturnType<typeof useSearchPaneResults>) => api.trackRows.value.map(track => track.title);

  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    await db.artists.add({ id: ArtistId("ar1"), name: "Artist", pinned: 1, addedAt: 1, updatedAt: 1 });
    await db.tracks.bulkAdd([row("t1", "First"), row("t2", "Second")]);
    searchState.results.value = { groups: groupsOf([]), topResults: [] };
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
  });

  it("useSearchPaneResults: follows the row after a write", async () => {
    searchState.results.value = { groups: groupsOf(["t2", "t1"]), topResults: [] };
    const api = start();
    await until(() => api.trackRows.value.length === 2);
    expect(titles(api)).toEqual(["Second", "First"]);

    const [track] = await getTracksByIds([TrackId("t1")]);
    await updateTrackMetadataAndSync(new QueryClient(), track, { title: "Renamed", artistNames: ["Artist"] });

    await until(() => titles(api)[1] === "Renamed");
    expect(titles(api)).toEqual(["Second", "Renamed"]);
  });

  it("drops the rows as soon as the query has no track hits", async () => {
    searchState.results.value = { groups: groupsOf(["t1"]), topResults: [] };
    const api = start();
    await until(() => api.trackRows.value.length === 1);

    searchState.results.value = { groups: groupsOf([]), topResults: [] };

    expect(api.trackRows.value).toEqual([]);
  });
});
