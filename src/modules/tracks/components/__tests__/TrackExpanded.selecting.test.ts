import { fireEvent, render } from "@testing-library/vue";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { createPinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackSource, TrackState } from "@/db/entities";
import type { Track } from "@/modules/player/types";
import { i18n } from "@/app/i18n";

// Regression: in select mode the row's artist/album links used to navigate,
// unmounting the page and throwing the whole selection away.

const pushMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: pushMock }),
  useRoute: () => ({}),
}));
vi.mock("@/modules/tracks/composables/useTrackMenu", () => ({
  useTrackMenu: () => ({ openDropdown: vi.fn(), isMenuOpenFor: () => false }),
}));
vi.mock("@/modules/tracks/composables/useToggleTrackLike", () => ({
  useToggleTrackLike: () => ({ toggleTrackLike: vi.fn() }),
}));
vi.mock("@/modules/tracks/composables/useTrackRowCover", async () => {
  const { shallowRef } = await import("vue");
  return { useTrackRowCover: () => shallowRef("/img/fallback.svg") };
});

import TrackExpanded from "../TrackExpanded.vue";

const makeTrack = (id: string): Track => ({
  kind: "library",
  id: id as Track["id"],
  title: id,
  artist: "Artist One",
  artistIds: ["ar1" as Track["artistIds"][number]],
  albumId: "a1" as Track["albumId"],
  albumName: "Album One",
  storagePath: `tracks/${id}.mp3`,
  source: TrackSource.LOCAL_INTERNAL,
  state: TrackState.READY,
  duration: 100,
  isLiked: false,
});

const renderRow = (isSelecting: boolean, extra: Record<string, unknown> = {}) => render(TrackExpanded, {
  props: { track: makeTrack("t1"), index: 0, isSelecting, ...extra },
  global: {
    plugins: [createPinia(), VueQueryPlugin, i18n],
    directives: { ripple: {} },
    stubs: {
      NuxtImage: true,
      SourceDownloadButton: true,
    },
  },
});

describe("TrackExpanded in select mode", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it("selects instead of navigating when the album link is clicked while selecting", async () => {
    const { getByRole, emitted } = renderRow(true);

    await fireEvent.click(getByRole("button", { name: "Album One" }));

    expect(emitted().select).toHaveLength(1);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("selects instead of navigating when the artist link is clicked while selecting", async () => {
    const { getByRole, emitted } = renderRow(true);

    await fireEvent.click(getByRole("button", { name: "Artist One" }));

    expect(emitted().select).toHaveLength(1);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("navigates from the album link when not selecting", async () => {
    const { getByRole, emitted } = renderRow(false);

    await fireEvent.click(getByRole("button", { name: "Album One" }));

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(emitted().select).toBeUndefined();
  });

  it("navigates from the artist link when not selecting", async () => {
    const { getByRole } = renderRow(false);

    await fireEvent.click(getByRole("button", { name: "Artist One" }));

    expect(pushMock).toHaveBeenCalledTimes(1);
  });

  it("ctrl-click plays on a page that did not opt into selection", async () => {
    const { container, emitted } = renderRow(false);

    await fireEvent.click(container.querySelector("[data-track-id]")!, { ctrlKey: true });

    expect(emitted().play).toHaveLength(1);
    expect(emitted().select).toBeUndefined();
  });

  it("ctrl-click selects on a selectable page", async () => {
    const { container, emitted } = renderRow(false, { selectable: true });

    await fireEvent.click(container.querySelector("[data-track-id]")!, { ctrlKey: true });

    expect(emitted().select).toHaveLength(1);
    expect(emitted().play).toBeUndefined();
  });

  it("renders a single checkbox while selecting", () => {
    for (const showCover of [true, false]) {
      const { container, unmount } = renderRow(true, { showCover });
      expect(container.querySelectorAll("[data-slot=checkbox]"), `showCover: ${showCover}`).toHaveLength(1);
      unmount();
    }
  });

  it("hooks the single checkbox to the cover corner when the row has a cover, reflecting the selection", async () => {
    const { container, rerender, unmount } = renderRow(true, { isSelected: true });
    const badge = container.querySelector("[data-cover-check]")!;
    const checkbox = container.querySelector("[data-slot=checkbox]")!;
    expect(badge.contains(checkbox)).toBe(true);
    expect(checkbox.getAttribute("data-state")).toBe("checked");

    await rerender({ isSelected: false });
    expect(checkbox.getAttribute("data-state")).toBe("unchecked");
    unmount();

    const coverless = renderRow(true, { showCover: false, isSelected: true });
    expect(coverless.container.querySelector("[data-cover-check]")).toBeNull();
    expect(coverless.container.querySelector("[data-slot=checkbox]")!.getAttribute("data-state")).toBe("checked");
  });

  it("selects instead of playing when the checkbox is clicked", async () => {
    for (const showCover of [true, false]) {
      const { container, emitted, unmount } = renderRow(true, { showCover });

      await fireEvent.click(container.querySelector("[data-slot=checkbox]")!);

      const selects = emitted<[unknown, MouseEvent]>().select;
      expect(selects, `showCover: ${showCover}`).toHaveLength(1);
      expect(selects[0][1]).toBeInstanceOf(MouseEvent);
      expect(emitted().play).toBeUndefined();
      unmount();
    }
  });

  it("renders no cover checkbox outside select mode", () => {
    const { container } = renderRow(false);
    expect(container.querySelector("[data-cover-check]")).toBeNull();
  });

  it("keeps showing the liked state while selecting, without the button", () => {
    const { container } = renderRow(true, { track: { ...makeTrack("t1"), isLiked: true } });

    expect(container.querySelector("[data-liked-indicator]")).not.toBeNull();
    expect(container.querySelector("button[aria-label], [data-slot=button]")).toBeNull();
  });

  it("shows no liked indicator while selecting an unliked track", () => {
    const { container } = renderRow(true);

    expect(container.querySelector("[data-liked-indicator]")).toBeNull();
  });

  it("marks joined corners so adjacent selected rows merge", () => {
    const { container } = renderRow(true, { isSelected: true, joinTop: true, joinBottom: false });
    const row = container.querySelector("[data-track-id]")!;

    expect(row.hasAttribute("data-join-top")).toBe(true);
    expect(row.hasAttribute("data-join-bottom")).toBe(false);
  });
});
