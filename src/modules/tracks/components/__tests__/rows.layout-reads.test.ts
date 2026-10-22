import { render } from "@testing-library/vue";
import { flushPromises } from "@vue/test-utils";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { createPinia } from "pinia";
import { afterEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import { TrackSource, TrackState } from "@/db/entities";
import type { Track } from "@/modules/player/types";
import type { SourceTrackDTO } from "@/modules/sources/types";

// A list mounts rows on every scroll step. Anything in a row that reads
// layout while mounting (motion's isHidden reads offsetParent) forces one
// layout per row, after the previous row dirtied it.

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({}),
}));
vi.mock("@/modules/tracks/composables/useTrackMenu", () => ({
  useTrackMenu: () => ({ openMenu: vi.fn(), openDropdown: vi.fn(), isMenuOpenFor: () => false }),
}));
vi.mock("@/modules/tracks/composables/useToggleTrackLike", () => ({
  useToggleTrackLike: () => ({ toggleTrackLike: vi.fn() }),
}));
vi.mock("@/modules/tracks/composables/useTrackRowCover", async () => {
  const { shallowRef } = await import("vue");
  return { useTrackRowCover: () => shallowRef("/img/fallback.svg") };
});

import TrackExpanded from "../TrackExpanded.vue";
import TrackRow from "../TrackRow.vue";
import SourceDownloadButton from "@/modules/downloads/components/SourceDownloadButton.vue";

const track: Track = {
  kind: "library",
  id: "t1" as Track["id"],
  title: "Song",
  artist: "Artist One",
  artistIds: ["ar1" as Track["artistIds"][number]],
  albumId: "a1" as Track["albumId"],
  albumName: "Album One",
  storagePath: "tracks/t1.mp3",
  source: TrackSource.LOCAL_INTERNAL,
  state: TrackState.READY,
  duration: 100,
  isLiked: false,
};

const global = {
  plugins: [createPinia(), VueQueryPlugin, i18n],
  directives: { ripple: {} },
  stubs: { NuxtImage: true },
};

// happy-dom has no offsetParent; a counting getter stands in for the layout read.
const offsetParentReads = () => {
  const reads = vi.fn(function (this: HTMLElement) {
    return this.parentElement;
  });
  Object.defineProperty(HTMLElement.prototype, "offsetParent", { configurable: true, get: reads });
  return reads;
};

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, "offsetParent");
});

describe("track rows read no layout while mounting", () => {
  it("TrackExpanded with a cover", async () => {
    const reads = offsetParentReads();
    render(TrackExpanded, { props: { track, index: 1 }, global });
    await flushPromises();
    expect(reads).not.toHaveBeenCalled();
  });

  it("TrackExpanded with the index column", async () => {
    const reads = offsetParentReads();
    render(TrackExpanded, { props: { track, index: 1, showCover: false }, global });
    await flushPromises();
    expect(reads).not.toHaveBeenCalled();
  });

  it("TrackRow", async () => {
    const reads = offsetParentReads();
    render(TrackRow, { props: { track, index: 1 }, global: { ...global, stubs: { ...global.stubs, SourceDownloadButton: true } } });
    await flushPromises();
    expect(reads).not.toHaveBeenCalled();
  });

  it("SourceDownloadButton", async () => {
    const reads = offsetParentReads();
    const dto = { id: "nd:s1", title: "Song", coverRef: "c1" } as SourceTrackDTO;
    render(SourceDownloadButton, { props: { dto }, global });
    await flushPromises();
    expect(reads).not.toHaveBeenCalled();
  });
});
