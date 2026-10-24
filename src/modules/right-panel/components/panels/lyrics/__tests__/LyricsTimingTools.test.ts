import { fireEvent, render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, reactive } from "vue";
import { i18n } from "@/app/i18n";
import { TrackSource, TrackState } from "@/db/entities";
import type { TrackLyricsLoadResult } from "@/modules/player/service/track-lyrics-loader.service";
import type { PlayerTrack, Track } from "@/modules/player/types";

const mockPlayerState = reactive({
  currentTime: 0,
  currentTrack: null as PlayerTrack | null,
  canSeek: true,
  seekTo: vi.fn(),
});

const actions = vi.hoisted(() => ({
  saveText: vi.fn(),
  attachFile: vi.fn(),
  deleteLyrics: vi.fn(),
  removeMissing: vi.fn(),
  setOffset: vi.fn(),
}));
const dialog = vi.hoisted(() => ({ summonDialog: vi.fn() }));

vi.mock("@/modules/player/store/player.store", () => ({ usePlayerStore: () => mockPlayerState }));
vi.mock("@/modules/player/service/track-lyrics-loader.service", () => ({ loadTrackLyrics: vi.fn() }));
vi.mock("@/modules/player/composables/useLyricsActions", async () => {
  const { ref } = await import("vue");
  return { useLyricsActions: () => ({ ...actions, isPending: ref(false) }) };
});
vi.mock("@/components/dialogs/summonDialog", () => dialog);
vi.mock("@/modules/tracks/composables/useEphemeralImport", async () => {
  const { computed, ref } = await import("vue");
  return {
    useEphemeralImport: () => ({ importPath: computed(() => null), isRunning: ref(false), importCurrent: vi.fn() }),
  };
});

import { loadTrackLyrics } from "@/modules/player/service/track-lyrics-loader.service";
import { useLyricsStore } from "@/modules/player/store/lyrics.store";
import LyricsPanel from "../LyricsPanel.vue";

const loader = vi.mocked(loadTrackLyrics);

const slotStub = { template: "<div><slot /></div>" };
const stubs = {
  Scrollable: slotStub,
  RightPanelHeader: {
    props: ["title", "description", "showBack"],
    emits: ["back", "close"],
    template: `<header>
      <h2>{{ title }}</h2>
      <p v-if="description" data-testid="header-description">{{ description }}</p>
      <button v-if="showBack" type="button" data-testid="header-back" @click="$emit('back')"></button>
      <button type="button" data-testid="header-close" @click="$emit('close')"></button>
      <slot name="trailing" />
    </header>`,
  },
  FloatingActionButton: {
    props: ["show"],
    template: "<div data-testid=\"fab\" :data-show=\"String(show)\"><slot /></div>",
  },
  Menu: { template: "<div role=\"menu\"><slot /></div>" },
  MenuTrigger: slotStub,
  MenuLabel: { template: "<div data-testid=\"menu-label\"><slot /></div>" },
  MenuSeparator: { template: "<hr />" },
  MenuItem: {
    props: ["color"],
    template: "<button type=\"button\" role=\"menuitem\" :data-color=\"color\"><slot /></button>",
  },
};

const track: Track = {
  kind: "library",
  id: "t1" as Track["id"],
  title: "Song",
  artist: "Artist",
  artistIds: [],
  albumId: "a1" as Track["albumId"],
  albumName: "Album",
  storagePath: "tracks/t1.mp3",
  source: TrackSource.LOCAL_INTERNAL,
  state: TrackState.READY,
  duration: 200,
  isLiked: false,
  lyricsPath: "lyrics/t1.lrc",
  lyricsFileName: "Song.lrc",
};

const synced: TrackLyricsLoadResult = {
  status: "ready",
  lyrics: {
    kind: "synced",
    lines: [{ time: 10, text: "One" }, { time: 20, text: "Two" }, { time: 30, text: "Three" }],
  },
  raw: "[00:10.00]One\n[00:20.00]Two\n[00:30.00]Three",
  source: { type: "file", fileName: "Song.lrc" },
};

const play = async (playing: Track = track) => {
  mockPlayerState.currentTrack = playing;
  loader.mockResolvedValueOnce(synced);
  await useLyricsStore().loadFor(playing, { force: true });
};

const renderPanel = () => render(LyricsPanel, { global: { plugins: [i18n], stubs } });

const enterAdjust = () => userEvent.click(screen.getByRole("menuitem", { name: "Adjust timing" }));

const lineEl = (text: string) => screen.getByText(text).closest("[data-slot='lyrics-line']") as HTMLElement;
const highlighted = () => document.querySelector("[aria-current='true'] span")?.textContent?.trim() ?? null;
const value = () => screen.getByRole("status");
const heading = () => screen.getByRole("heading").textContent?.trim();
const fab = () => screen.getByTestId("fab");

describe("LyricsTimingTools", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
    vi.clearAllMocks();
    mockPlayerState.currentTime = 0;
    mockPlayerState.currentTrack = null;
  });

  it("moves the highlight live and restores it when leaving without saving", async () => {
    mockPlayerState.currentTime = 19.95;
    await play();
    renderPanel();

    expect(highlighted()).toBe("One");
    await enterAdjust();

    expect(heading()).toBe("Adjust timing");
    expect(screen.getByTestId("header-description")).toHaveTextContent("Song \u00B7 Artist");
    expect(screen.getByText("Tap the line you hear right now to sync to it.")).toBeInTheDocument();
    expect(value()).toHaveTextContent("0.0 s");
    expect(lineEl("Two")).toHaveTextContent("0:20.0");

    await userEvent.click(screen.getByRole("button", { name: "Show lines 0.1 s earlier" }));

    expect(value()).toHaveTextContent("-0.1 s");
    expect(highlighted()).toBe("Two");
    expect(lineEl("Two")).toHaveTextContent("0:19.9");
    expect(useLyricsStore().offsetMs).toBe(-100);

    dialog.summonDialog.mockResolvedValueOnce(true);
    await userEvent.click(screen.getByTestId("header-back"));
    await flushPromises();

    expect(dialog.summonDialog).toHaveBeenCalledWith("unsavedChanges", {}, { key: "unsaved-changes" });
    expect(heading()).toBe("Lyrics");
    expect(highlighted()).toBe("One");
    expect(useLyricsStore().offsetMs).toBe(0);

    await enterAdjust();
    await userEvent.click(screen.getByRole("button", { name: "Show lines 0.1 s earlier" }));
    expect(highlighted()).toBe("Two");

    mockPlayerState.currentTrack = { ...track, id: "t2" as Track["id"], title: "Next" };
    await nextTick();

    expect(heading()).toBe("Lyrics");
    expect(useLyricsStore().offsetMs).toBe(0);
    expect(dialog.summonDialog).toHaveBeenCalledTimes(1);
    expect(actions.setOffset).not.toHaveBeenCalled();
  });

  it("steps by 0.1 s and repeats while held", async () => {
    await play();
    renderPanel();
    await enterAdjust();
    const later = screen.getByRole("button", { name: "Show lines 0.1 s later" });
    const earlier = screen.getByRole("button", { name: "Show lines 0.1 s earlier" });

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    try {
      await fireEvent.pointerDown(later, { button: 0 });
      expect(value()).toHaveTextContent("+0.1 s");

      await vi.advanceTimersByTimeAsync(399);
      expect(value()).toHaveTextContent("+0.1 s");

      await vi.advanceTimersByTimeAsync(1);
      expect(value()).toHaveTextContent("+0.2 s");

      await vi.advanceTimersByTimeAsync(300);
      expect(value()).toHaveTextContent("+0.5 s");

      await fireEvent.pointerUp(later, { button: 0 });
      await fireEvent.click(later, { detail: 1 });
      await vi.advanceTimersByTimeAsync(1000);
      expect(value()).toHaveTextContent("+0.5 s");

      await fireEvent.pointerDown(earlier, { button: 0 });
      await vi.advanceTimersByTimeAsync(500);
      expect(value()).toHaveTextContent("+0.2 s");

      await fireEvent.pointerLeave(earlier);
      await vi.advanceTimersByTimeAsync(1000);
      expect(value()).toHaveTextContent("+0.2 s");
    }
    finally {
      vi.useRealTimers();
    }

    later.focus();
    await userEvent.keyboard("{Enter}");
    await nextTick();

    expect(value()).toHaveTextContent("+0.3 s");
    expect(useLyricsStore().offsetMs).toBe(300);
  });

  it("sets the offset from a tapped line", async () => {
    mockPlayerState.currentTime = 25.04;
    await play();
    renderPanel();
    await enterAdjust();

    await userEvent.click(lineEl("Two"));

    expect(value()).toHaveTextContent("+5.0 s");
    expect(highlighted()).toBe("Two");
    expect(lineEl("Two")).toHaveTextContent("0:25.0");

    mockPlayerState.currentTime = 25.06;
    await userEvent.click(lineEl("Three"));

    expect(value()).toHaveTextContent("-5.0 s");
    expect(useLyricsStore().offsetMs).toBe(-5000);
    expect(highlighted()).toBe("Three");
    expect(mockPlayerState.seekTo).not.toHaveBeenCalled();
    expect(actions.setOffset).not.toHaveBeenCalled();
  });

  it("resets to zero", async () => {
    await play({ ...track, lyricsOffsetMs: 800 });
    renderPanel();
    await enterAdjust();

    const reset = screen.getByRole("button", { name: "Reset" });
    expect(value()).toHaveTextContent("+0.8 s");
    expect(reset).toBeEnabled();
    expect(fab()).toHaveAttribute("data-show", "false");

    await userEvent.click(reset);

    expect(value()).toHaveTextContent("0.0 s");
    expect(value().textContent?.trim()).toBe("0.0 s");
    expect(reset).toBeDisabled();
    expect(useLyricsStore().offsetMs).toBe(0);
    expect(fab()).toHaveAttribute("data-show", "true");
  });

  it("saves the offset from the floating button", async () => {
    await play();
    renderPanel();
    await enterAdjust();
    expect(fab()).toHaveAttribute("data-show", "false");

    const earlier = screen.getByRole("button", { name: "Show lines 0.1 s earlier" });
    await userEvent.click(earlier);
    await userEvent.click(earlier);
    expect(fab()).toHaveAttribute("data-show", "true");

    actions.setOffset.mockImplementation(async (saved: Track, offsetMs: number) => {
      const next = { ...saved, lyricsOffsetMs: offsetMs };
      mockPlayerState.currentTrack = next;
      return next;
    });
    await userEvent.click(screen.getByRole("button", { name: "Save timing" }));
    await flushPromises();

    expect(actions.setOffset).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }), -200);
    expect(heading()).toBe("Lyrics");
    expect(dialog.summonDialog).not.toHaveBeenCalled();
    expect(useLyricsStore().offsetMs).toBe(-200);

    mockPlayerState.currentTrack = { ...track, lyricsOffsetMs: 300 };
    expect(useLyricsStore().offsetMs).toBe(300);
  });

  it("stays in adjust mode when saving the offset fails", async () => {
    await play();
    renderPanel();
    await enterAdjust();

    await userEvent.click(screen.getByRole("button", { name: "Show lines 0.1 s later" }));
    actions.setOffset.mockRejectedValueOnce(new Error("disk full"));
    await userEvent.click(screen.getByRole("button", { name: "Save timing" }));
    await flushPromises();

    expect(heading()).toBe("Adjust timing");
    expect(value()).toHaveTextContent("+0.1 s");
    expect(useLyricsStore().offsetMs).toBe(100);
  });
});
