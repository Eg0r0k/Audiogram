import { render, screen, within } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, reactive } from "vue";
import { i18n } from "@/app/i18n";
import { TrackSource, TrackState } from "@/db/entities";
import { textSafeAccent } from "@/lib/color/text-safe-accent";
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
};

const plain: TrackLyricsLoadResult = {
  status: "ready",
  lyrics: { kind: "plain", lines: ["First", "Second", "", "Third"] },
  raw: "First\nSecond\n\nThird",
  source: { type: "lrclib" },
};

const BLUE = "oklch(0.6444 0.1623 251.76)";
const PINK = "oklch(0.6805 0.1983 348.87)";

const play = async () => {
  mockPlayerState.currentTrack = track;
  loader.mockResolvedValueOnce(plain);
  await useLyricsStore().loadFor(track, { force: true });
};

const renderPanel = () => render(LyricsPanel, { global: { plugins: [i18n], stubs } });

const enterSync = async () => {
  await play();
  const view = renderPanel();
  await userEvent.click(screen.getByRole("button", { name: "Sync line by line" }));
  return view;
};

const lineEl = (text: string) => screen.getByText(text).closest("[data-slot='lyrics-line']") as HTMLElement;
const target = () => document.querySelector("[data-slot='lyrics-line'].bg-muted span")?.textContent?.trim() ?? null;
const heading = () => screen.getByRole("heading").textContent?.trim();
const description = () => screen.queryByTestId("header-description")?.textContent?.trim();
const fabButton = () => within(screen.getByTestId("fab")).getByRole("button");
const undo = () => screen.getByRole("button", { name: "Undo" });

const markAt = async (time: number) => {
  mockPlayerState.currentTime = time;
  await nextTick();
  await userEvent.click(fabButton());
};

const space = (init: KeyboardEventInit = {}) =>
  new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true, ...init });

describe("LyricsSyncMode", () => {
  const bubbled = vi.fn();

  beforeEach(() => {
    i18n.global.locale.value = "en";
    vi.clearAllMocks();
    mockPlayerState.currentTime = 0;
    mockPlayerState.currentTrack = null;
    actions.saveText.mockImplementation(async (saved: Track) => saved);
    window.addEventListener("keydown", bubbled);
  });

  afterEach(() => {
    window.removeEventListener("keydown", bubbled);
    document.documentElement.style.removeProperty("--primary");
  });

  it("marks the highlighted line with the current time", async () => {
    mockPlayerState.currentTime = 3.24;
    await enterSync();

    expect(heading()).toBe("Sync lyrics");
    expect(description()).toBe("Line 1 of 3");
    expect(screen.getByText("Press when the highlighted line starts. Space works too.")).toBeInTheDocument();
    expect(target()).toBe("First");
    expect(fabButton()).toHaveAccessibleName("Mark line \u00B7 0:03.2");

    await userEvent.click(fabButton());

    expect(lineEl("First")).toHaveTextContent("0:03.2");
    expect(description()).toBe("Line 2 of 3");
    expect(target()).toBe("Second");

    await userEvent.click(lineEl("Third"));
    expect(description()).toBe("Line 2 of 3");
    expect(lineEl("Third").textContent?.trim()).toBe("Third");

    mockPlayerState.currentTime = 2;
    await nextTick();
    expect(fabButton()).toHaveAccessibleName("Mark line \u00B7 0:02.0");
    await userEvent.click(lineEl("Second"));

    expect(lineEl("Second")).toHaveTextContent("0:03.2");
    expect(description()).toBe("Line 3 of 3");
    expect(target()).toBe("Third");
    expect(mockPlayerState.seekTo).not.toHaveBeenCalled();
    expect(actions.saveText).not.toHaveBeenCalled();
  });

  it("marks with Space and keeps Space from toggling playback", async () => {
    mockPlayerState.currentTime = 1.5;
    await enterSync();

    const press = space();
    document.body.dispatchEvent(press);
    await nextTick();

    expect(press.defaultPrevented).toBe(true);
    expect(bubbled).not.toHaveBeenCalled();
    expect(description()).toBe("Line 2 of 3");
    expect(lineEl("First")).toHaveTextContent("0:01.5");

    const held = space({ repeat: true });
    document.body.dispatchEvent(held);
    await nextTick();

    expect(held.defaultPrevented).toBe(true);
    expect(bubbled).not.toHaveBeenCalled();
    expect(description()).toBe("Line 2 of 3");

    dialog.summonDialog.mockResolvedValueOnce(true);
    await userEvent.click(screen.getByTestId("header-back"));
    await flushPromises();
    expect(heading()).toBe("Lyrics");

    const afterwards = space();
    document.body.dispatchEvent(afterwards);

    expect(afterwards.defaultPrevented).toBe(false);
    expect(bubbled).toHaveBeenCalledTimes(1);
  });

  it("ignores Space while typing in a field", async () => {
    await enterSync();

    const input = document.createElement("input");
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    document.body.append(input, editable);
    try {
      for (const field of [input, editable]) {
        field.focus();
        const press = space();
        field.dispatchEvent(press);
        await nextTick();

        expect(press.defaultPrevented).toBe(false);
        expect(description()).toBe("Line 1 of 3");
      }
      expect(bubbled).toHaveBeenCalledTimes(2);
    }
    finally {
      input.remove();
      editable.remove();
    }
  });

  it("leaves Space alone while a dialog is open over sync mode", async () => {
    await enterSync();

    const layer = document.createElement("div");
    layer.setAttribute("data-dismissable-layer", "");
    layer.setAttribute("role", "alertdialog");
    const discard = document.createElement("button");
    layer.append(discard);
    document.body.append(layer);
    try {
      discard.focus();
      const onButton = space();
      discard.dispatchEvent(onButton);
      const onBody = space();
      document.body.dispatchEvent(onBody);
      await nextTick();

      expect(onButton.defaultPrevented).toBe(false);
      expect(onBody.defaultPrevented).toBe(false);
      expect(bubbled).toHaveBeenCalledTimes(2);
      expect(description()).toBe("Line 1 of 3");

      layer.removeAttribute("data-dismissable-layer");
      layer.setAttribute("role", "menu");
      const inMenu = space();
      discard.dispatchEvent(inMenu);
      await nextTick();

      expect(inMenu.defaultPrevented).toBe(false);
      expect(description()).toBe("Line 1 of 3");
    }
    finally {
      layer.remove();
    }

    const afterwards = space();
    document.body.dispatchEvent(afterwards);
    await nextTick();

    expect(afterwards.defaultPrevented).toBe(true);
    expect(description()).toBe("Line 2 of 3");
  });

  it("undoes the last mark", async () => {
    await enterSync();
    expect(undo()).toBeDisabled();

    await markAt(1);
    await markAt(2);
    expect(description()).toBe("Line 3 of 3");
    expect(undo()).toBeEnabled();

    await userEvent.click(undo());

    expect(description()).toBe("Line 2 of 3");
    expect(target()).toBe("Second");
    expect(lineEl("Second").textContent?.trim()).toBe("Second");
    expect(lineEl("First")).toHaveTextContent("0:01.0");

    await userEvent.click(undo());

    expect(description()).toBe("Line 1 of 3");
    expect(target()).toBe("First");
    expect(undo()).toBeDisabled();

    await userEvent.click(screen.getByTestId("header-back"));
    expect(dialog.summonDialog).not.toHaveBeenCalled();
    expect(heading()).toBe("Lyrics");
  });

  it("turns the floating button into Save after the last line and saves synced lyrics", async () => {
    await enterSync();

    await markAt(1);
    await markAt(2);
    await markAt(3.5);

    expect(description()).toBe("Line 3 of 3");
    expect(target()).toBeNull();
    expect(fabButton()).toHaveAccessibleName("Save lyrics");

    await userEvent.click(fabButton());
    await flushPromises();

    expect(actions.saveText).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t1" }),
      "[00:01.00]First\n[00:02.00]Second\n[00:03.50]\n[00:03.50]Third",
      { resetOffset: true },
    );
    expect(heading()).toBe("Lyrics");
    expect(dialog.summonDialog).not.toHaveBeenCalled();
  });

  it("paints the extended button white on the darkened accent and follows accent changes", async () => {
    document.documentElement.style.setProperty("--primary", BLUE);
    await enterSync();

    const button = fabButton();
    expect(button.style.getPropertyValue("--tone")).toBe(textSafeAccent(BLUE));
    expect(button.style.getPropertyValue("--tone-foreground")).toBe("#ffffff");

    document.documentElement.style.setProperty("--primary", PINK);

    await vi.waitFor(() => expect(button.style.getPropertyValue("--tone")).toBe(textSafeAccent(PINK)));
  });

  it("returns to the lyrics and drops the marks when the track changes", async () => {
    await enterSync();
    await markAt(1);

    mockPlayerState.currentTrack = { ...track, id: "t2" as Track["id"], title: "Next" };
    await nextTick();

    expect(heading()).toBe("Lyrics");
    expect(dialog.summonDialog).not.toHaveBeenCalled();
  });
});
