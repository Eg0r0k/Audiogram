import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import { TrackSource, TrackState } from "@/db/entities";
import type { PlayerTrack, Track } from "@/modules/player/types";
import { usePlayerStore } from "@/modules/player/store/player.store";
import CurrentTrackPanel from "../CurrentTrackPanel.vue";

const importCurrentMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/tracks/composables/useEphemeralImport", async () => {
  const { computed, ref, toValue } = await import("vue");
  const { ephemeralFilePath } = await import("@/modules/tracks/lib/trackPredicates");
  return {
    useEphemeralImport: (track: unknown) => ({
      importPath: computed(() => ephemeralFilePath(toValue(track) as PlayerTrack | null)),
      isRunning: ref(false),
      importCurrent: importCurrentMock,
    }),
  };
});
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/modules/covers/composables/useEntityCover", async () => {
  const { ref } = await import("vue");
  return { useEntityCover: () => ({ url: ref<string | null>(null) }) };
});
vi.mock("@/modules/player/composables/useMobilePlayerColor", async () => {
  const { ref } = await import("vue");
  return { useMobilePlayerColor: () => ({ color: ref({ hsl: "0 0% 0%" }) }) };
});
vi.mock("@/modules/tracks/composables/useTrackMenu", () => ({
  useTrackMenu: () => ({ openDropdown: vi.fn(), openMenu: vi.fn() }),
}));
vi.mock("@/modules/tracks/composables/useToggleTrackLike", () => ({
  useToggleTrackLike: () => ({ toggleTrackLike: vi.fn() }),
}));

const slotStub = { template: "<div><slot /></div>" };
const stubs = {
  Scrollable: slotStub,
  RightPanelHeader: true,
  NuxtImage: true,
  MarqueeBlock: slotStub,
  TrackRow: true,
  TrackContextMenu: slotStub,
  TrackDropdown: true,
  MorphingDialog: slotStub,
  MorphingDialogTrigger: slotStub,
  MorphingDialogContainer: slotStub,
  MorphingDialogContent: slotStub,
  MorphingDialogClose: slotStub,
};

function renderPanel(track: PlayerTrack | null) {
  setActivePinia(createPinia());
  const playerStore = usePlayerStore();
  playerStore.currentTrack = track;
  return render(CurrentTrackPanel, {
    global: { plugins: [i18n], stubs },
  });
}

function libraryTrack(): Track {
  return {
    kind: "library",
    id: "t1" as Track["id"],
    title: "Library",
    artist: "Artist",
    artistIds: [],
    albumId: "a1" as Track["albumId"],
    albumName: "Album",
    storagePath: "tracks/t1.mp3",
    source: TrackSource.LOCAL_INTERNAL,
    state: TrackState.READY,
    duration: 100,
    isLiked: false,
  };
}

describe("CurrentTrackPanel import CTA", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
    importCurrentMock.mockReset();
  });

  it("shows the import button for an open-with ephemeral track and runs the import", async () => {
    renderPanel({
      kind: "ephemeral",
      id: "eph-1",
      title: "Open-with file",
      source: { type: "path", path: "C:/Music/x.flac" },
    });

    const button = screen.getByRole("button", { name: "Import to library" });
    await userEvent.click(button);

    expect(importCurrentMock).toHaveBeenCalledTimes(1);
  });

  it("shows the like button instead for library tracks", () => {
    renderPanel(libraryTrack());

    expect(screen.queryByRole("button", { name: "Import to library" })).toBeNull();
  });
});

describe("CurrentTrackPanel cover colour", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
  });

  // The colour arrives ~400 ms after the track change; without a transition
  // the "Up Next" block snaps from neutral to the cover colour.
  it("crossfades the up-next block background when the cover colour lands", () => {
    renderPanel(libraryTrack());

    const block = screen.getByText("Up Next").closest("div.rounded-sm") as HTMLElement | null;
    expect(block).not.toBeNull();
    expect(block!.getAttribute("style")).toContain("--cover-color: 0 0% 0%");
    // The mix ratio is a design knob and has already been tuned once; what must
    // hold is that the background is derived from the cover colour at all.
    expect(block!.className).toMatch(/bg-\[color-mix\(in_oklch,var\(--cover-color\)_\d+%,black\)\]/);
    expect(block!.className).toContain("transition-[background-color]");
    expect(block!.className).toContain("duration-900");
    expect(block!.className).toContain("motion-reduce:transition-none");
  });
});
