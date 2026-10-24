import { fireEvent, render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, reactive } from "vue";
import { i18n } from "@/app/i18n";
import { TrackSource, TrackState } from "@/db/entities";
import type { TrackLyricsLoadResult } from "@/modules/player/service/track-lyrics-loader.service";
import type { EphemeralTrack, PlayerTrack, Track } from "@/modules/player/types";

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
import { useRightPanelStore } from "@/modules/right-panel/store/right-panel.store";
import LyricsPanel from "../LyricsPanel.vue";

const loader = vi.mocked(loadTrackLyrics);

const slotStub = { template: "<div><slot /></div>" };
const stubs = {
  Scrollable: { template: "<div data-testid=\"scroll-area\"><slot /></div>" },
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

const stream: EphemeralTrack = {
  kind: "ephemeral",
  id: "yt-1",
  title: "Stream",
  artist: "Someone",
  source: { type: "url", url: "https://example.com/a.m3u8" },
};

const RAW = "[00:10.00]One\n[00:20.00]Two";

const synced = (source: { type: "file"; fileName: string | null } | { type: "lrclib" }): TrackLyricsLoadResult => ({
  status: "ready",
  lyrics: { kind: "synced", lines: [{ time: 10, text: "One" }, { time: 20, text: "Two" }] },
  raw: RAW,
  source,
});

const plain: TrackLyricsLoadResult = {
  status: "ready",
  lyrics: { kind: "plain", lines: ["First", "", "Second"] },
  raw: "First\n\nSecond",
  source: { type: "lrclib" },
};

const play = async (result: TrackLyricsLoadResult, playing: PlayerTrack = track) => {
  mockPlayerState.currentTrack = playing;
  loader.mockResolvedValueOnce(result);
  await useLyricsStore().loadFor(playing, { force: true });
};

const renderPanel = () => render(LyricsPanel, { global: { plugins: [i18n], stubs } });

const menuItems = () => screen.queryAllByRole("menuitem").map(item => item.textContent?.trim());
const editor = () => screen.queryByRole("textbox", { name: "Lyrics" });
const description = () => screen.queryByTestId("header-description")?.textContent?.trim();

describe("LyricsPanel", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
    vi.clearAllMocks();
    mockPlayerState.currentTime = 0;
    mockPlayerState.currentTrack = null;
    actions.saveText.mockImplementation(async (saved: Track) => saved);
    actions.attachFile.mockResolvedValue(null);
  });

  it("describes the track as Title \u00B7 Artist in the header", async () => {
    await play({ status: "idle" });
    renderPanel();

    expect(screen.getByRole("heading", { name: "Lyrics" })).toBeInTheDocument();
    expect(description()).toBe("Song \u00B7 Artist");

    mockPlayerState.currentTrack = { ...stream, artist: undefined };
    await nextTick();

    expect(description()).toBe("Stream");
  });

  it("shows the source line and the full menu for the user's own file", async () => {
    await play(synced({ type: "file", fileName: "Song.lrc" }));
    const { unmount } = renderPanel();

    expect(screen.getByRole("button", { name: "More options" })).toBeInTheDocument();
    expect(screen.getByTestId("menu-label")).toHaveTextContent("Your file \u00B7 Song.lrc");
    expect(menuItems()).toEqual(["Edit lyrics", "Adjust timing", "Replace with file\u2026", "Delete lyrics"]);
    const remove = screen.getByRole("menuitem", { name: "Delete lyrics" });
    expect(remove).toHaveAttribute("data-color", "destructive");
    expect(remove.previousElementSibling?.tagName).toBe("HR");

    await userEvent.click(screen.getByRole("menuitem", { name: "Replace with file\u2026" }));
    await flushPromises();
    expect(actions.attachFile).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }));

    await userEvent.click(remove);
    expect(actions.deleteLyrics).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }));
    expect(dialog.summonDialog).not.toHaveBeenCalled();
    unmount();

    await play(synced({ type: "file", fileName: null }));
    renderPanel();

    expect(screen.getByTestId("menu-label")).toHaveTextContent(/^Your file$/);
  });

  it("shows Attach file instead of Replace and no Delete for LRCLIB lyrics", async () => {
    await play(synced({ type: "lrclib" }));
    const { unmount } = renderPanel();

    expect(screen.getByTestId("menu-label")).toHaveTextContent("From LRCLIB");
    expect(menuItems()).toEqual(["Edit lyrics", "Adjust timing", "Attach file\u2026"]);
    expect(screen.queryByRole("separator")).toBeNull();

    await userEvent.click(screen.getByRole("menuitem", { name: "Attach file\u2026" }));
    expect(actions.attachFile).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }));
    unmount();

    await play(plain);
    renderPanel();

    expect(menuItems()).toEqual(["Edit lyrics", "Attach file\u2026"]);
  });

  it("sizes the menu icons like the track menus", async () => {
    await play(synced({ type: "file", fileName: "Song.lrc" }));
    renderPanel();

    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(4);
    for (const item of items) {
      expect(item.querySelector("svg")).toHaveClass("size-5.5");
    }
    expect(screen.getByRole("button", { name: "More options" }).querySelector("svg")).toHaveClass("size-6");
  });

  it("shows no menu for a track outside the library", async () => {
    await play(synced({ type: "lrclib" }), stream);
    const { container, unmount } = renderPanel();

    expect(container.querySelectorAll("[data-slot='lyrics-line']")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "More options" })).toBeNull();
    expect(screen.queryByRole("menu")).toBeNull();
    unmount();

    await play({ status: "idle" });
    renderPanel();

    expect(screen.getByText("No lyrics for this track")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More options" })).toBeNull();
  });

  it("offers Sync line by line above plain lyrics", async () => {
    await play(plain);
    const { container, unmount } = renderPanel();

    const notice = screen.getByText("These lyrics aren't synced to the music.");
    const sync = screen.getByRole("button", { name: "Sync line by line" });
    const firstLine = container.querySelector("[data-slot='lyrics-line']");
    expect(firstLine).toHaveTextContent("First");
    expect(notice.compareDocumentPosition(firstLine!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sync.compareDocumentPosition(firstLine!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId("header-back")).toBeNull();

    await userEvent.click(sync);

    expect(screen.queryByText("These lyrics aren't synced to the music.")).toBeNull();
    expect(screen.getByTestId("header-back")).toBeInTheDocument();
    unmount();

    await play(plain, stream);
    renderPanel();

    expect(screen.getByText("These lyrics aren't synced to the music.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sync line by line" })).toBeNull();
  });

  it("asks before leaving the editor with unsaved changes", async () => {
    await play(synced({ type: "file", fileName: "Song.lrc" }));
    renderPanel();
    const rightPanel = useRightPanelStore();

    await userEvent.click(screen.getByRole("menuitem", { name: "Edit lyrics" }));
    expect(editor()).toHaveValue(RAW);
    expect(screen.getByRole("heading", { name: "Edit lyrics" })).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("header-back"));
    expect(dialog.summonDialog).not.toHaveBeenCalled();
    expect(editor()).toBeNull();

    await userEvent.click(screen.getByRole("menuitem", { name: "Edit lyrics" }));
    await fireEvent.update(editor()!, `${RAW}\n[00:30.00]Three`);

    dialog.summonDialog.mockResolvedValueOnce(undefined);
    await userEvent.click(screen.getByTestId("header-back"));
    await flushPromises();

    expect(dialog.summonDialog).toHaveBeenCalledWith("unsavedChanges", {}, { key: "unsaved-changes" });
    expect(editor()).toHaveValue(`${RAW}\n[00:30.00]Three`);

    dialog.summonDialog.mockResolvedValueOnce(undefined);
    rightPanel.stepBack();
    await flushPromises();

    expect(dialog.summonDialog).toHaveBeenCalledTimes(2);
    expect(editor()).not.toBeNull();

    dialog.summonDialog.mockResolvedValueOnce(true);
    await userEvent.click(screen.getByTestId("header-back"));
    await flushPromises();

    expect(dialog.summonDialog).toHaveBeenCalledTimes(3);
    expect(editor()).toBeNull();
    expect(screen.getByRole("heading", { name: "Lyrics" })).toBeInTheDocument();
    expect(actions.saveText).not.toHaveBeenCalled();
  });

  it("saves edited lyrics from the floating button", async () => {
    await play(synced({ type: "lrclib" }));
    renderPanel();

    await userEvent.click(screen.getByRole("menuitem", { name: "Edit lyrics" }));
    expect(screen.getByTestId("fab")).toHaveAttribute("data-show", "false");

    mockPlayerState.currentTrack = { ...track, id: "t2" as Track["id"], title: "Next", artist: "Other" };
    await nextTick();
    expect(description()).toBe("Song \u00B7 Artist");

    await fireEvent.update(editor()!, "[00:10.00]One, fixed");
    expect(screen.getByTestId("fab")).toHaveAttribute("data-show", "true");

    await userEvent.click(screen.getByRole("button", { name: "Save lyrics" }));
    await flushPromises();

    expect(actions.saveText).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t1" }),
      "[00:10.00]One, fixed",
      { resetOffset: false },
    );
    expect(editor()).toBeNull();
    expect(screen.getByRole("heading", { name: "Lyrics" })).toBeInTheDocument();
  });

  it("stays in the editor when saving fails", async () => {
    await play(synced({ type: "file", fileName: "Song.lrc" }));
    renderPanel();

    await userEvent.click(screen.getByRole("menuitem", { name: "Edit lyrics" }));
    await fireEvent.update(editor()!, "[00:10.00]Changed");
    actions.saveText.mockRejectedValueOnce(new Error("disk full"));
    await userEvent.click(screen.getByRole("button", { name: "Save lyrics" }));
    await flushPromises();

    expect(editor()).toHaveValue("[00:10.00]Changed");
  });

  it("describes the format of the text being written", async () => {
    await play({ status: "idle" });
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: "Write lyrics" }));
    expect(screen.getByRole("heading", { name: "Write lyrics" })).toBeInTheDocument();
    expect(editor()).toHaveAttribute(
      "placeholder",
      "Paste or type the lyrics. Plain text works; lines with [01:23.45] follow the music.",
    );
    expect(screen.queryByText(/^(Synced|Plain text) \u00B7/)).toBeNull();
    expect(screen.getByTestId("fab")).toHaveAttribute("data-show", "false");

    await fireEvent.update(editor()!, "[00:01.00]One\n[00:02.00]\n[00:03.00]Two");
    expect(screen.getByText("Synced \u00B7 2 lines with timestamps")).toBeInTheDocument();

    await fireEvent.update(editor()!, "[00:01.00]One");
    expect(screen.getByText("Synced \u00B7 1 line with timestamps")).toBeInTheDocument();

    await fireEvent.update(editor()!, "Just words\n\nMore words");
    expect(screen.getByText("Plain text \u00B7 shown without sync. You can sync it line by line later.")).toBeInTheDocument();
    expect(screen.getByTestId("fab")).toHaveAttribute("data-show", "true");

    await fireEvent.update(editor()!, "   \n ");
    expect(screen.queryByText(/^(Synced|Plain text) \u00B7/)).toBeNull();
    expect(screen.getByTestId("fab")).toHaveAttribute("data-show", "false");

    await fireEvent.update(editor()!, "New words");
    await userEvent.click(screen.getByRole("button", { name: "Save lyrics" }));
    await flushPromises();

    expect(actions.saveText).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }), "New words", { resetOffset: true });
    expect(editor()).toBeNull();
  });

  it("guards Attach file in the editor and returns to the lyrics afterwards", async () => {
    await play(synced({ type: "file", fileName: "Song.lrc" }));
    renderPanel();

    await userEvent.click(screen.getByRole("menuitem", { name: "Edit lyrics" }));
    await fireEvent.update(editor()!, "[00:10.00]Changed");

    dialog.summonDialog.mockResolvedValueOnce(undefined);
    await userEvent.click(screen.getByRole("button", { name: "Attach file" }));
    await flushPromises();

    expect(actions.attachFile).not.toHaveBeenCalled();
    expect(editor()).not.toBeNull();

    dialog.summonDialog.mockResolvedValueOnce(true);
    await userEvent.click(screen.getByRole("button", { name: "Attach file" }));
    await flushPromises();

    expect(actions.attachFile).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }));
    expect(editor()).toBeNull();
  });

  it("shows the editor's Attach file as an icon button", async () => {
    const expectIconButton = () => {
      const attach = screen.getByRole("button", { name: "Attach file" });
      expect(attach).toHaveAttribute("aria-label", "Attach file");
      expect(attach).toHaveAttribute("title", "Attach file");
      expect(attach.textContent?.trim()).toBe("");
      expect(attach.querySelector("svg")).not.toBeNull();
      expect(attach).toHaveAttribute("data-size", "icon-lg");
      expect(attach).toHaveAttribute("data-variant", "ghost");
      expect(attach).toHaveAttribute("data-color", "muted");
      expect(attach).toHaveClass("rounded-full");
    };

    await play(synced({ type: "file", fileName: "Song.lrc" }));
    const { unmount } = renderPanel();
    await userEvent.click(screen.getByRole("menuitem", { name: "Edit lyrics" }));
    expectIconButton();
    unmount();

    await play({ status: "idle" });
    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Write lyrics" }));
    expect(screen.getByRole("heading", { name: "Write lyrics" })).toBeInTheDocument();
    expectIconButton();
  });

  it("keeps the save button outside the scrolling area", async () => {
    await play(synced({ type: "file", fileName: "Song.lrc" }));
    const { container } = renderPanel();

    await userEvent.click(screen.getByRole("menuitem", { name: "Edit lyrics" }));

    const panelRoot = container.firstElementChild;
    const fab = screen.getByTestId("fab");
    expect(panelRoot).toHaveClass("overflow-hidden!");
    expect(fab.parentElement).toBe(panelRoot);
    expect(fab.closest("[data-testid='scroll-area']")).toBeNull();
    expect(editor()!.closest("[data-testid='scroll-area']")).not.toBeNull();
  });
});
