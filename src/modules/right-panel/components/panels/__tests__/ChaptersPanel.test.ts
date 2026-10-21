import { fireEvent, render, screen } from "@testing-library/vue";
import { flushPromises } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import { TrackSource, TrackState, type TrackChapterMark } from "@/db/entities";
import type { Track } from "@/modules/player/types";
import * as chaptersModule from "@/modules/tracks/composables/useTrackChapters";
import ChaptersPanel from "../ChaptersPanel.vue";

vi.mock("@/modules/tracks/composables/useTrackChapters", async () => {
  const { ref } = await import("vue");
  const data = ref<TrackChapterMark[]>([]);
  const mutate = vi.fn();
  const mutateAsync = vi.fn().mockResolvedValue(undefined);
  return {
    useTrackChapters: () => ({ data }),
    useSaveTrackChapters: () => ({ mutate, mutateAsync, isPending: ref(false) }),
    __mocks: { data, mutate, mutateAsync },
  };
});

const fileDialog = vi.hoisted(() => ({ onChange: undefined as ((files: File[] | null) => void) | undefined }));

vi.mock("@vueuse/core", async importOriginal => ({
  ...(await importOriginal<typeof import("@vueuse/core")>()),
  useFileDialog: () => ({
    open: () => {},
    onChange: (handler: (files: File[] | null) => void) => {
      fileDialog.onChange = handler;
    },
  }),
}));

const CUE = ["TRACK 01 AUDIO", "  TITLE \"Intro\"", "  INDEX 01 00:00:00", "TRACK 02 AUDIO", "  TITLE \"Two\"", "  INDEX 01 01:00:00"].join("\n");

const mocks = (chaptersModule as unknown as {
  __mocks: { data: ReturnType<typeof ref<TrackChapterMark[]>>; mutate: ReturnType<typeof vi.fn>; mutateAsync: ReturnType<typeof vi.fn> };
}).__mocks;

const slotStub = { template: "<div><slot /></div>" };
const stubs = {
  Scrollable: slotStub,
  RightPanelHeader: { template: `<div><slot name="leading" /><slot name="trailing" /></div>` },
};

const track = (): Track => ({
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
  duration: 300,
  isLiked: false,
});

const renderPanel = () => render(ChaptersPanel, {
  props: { track: track() },
  global: { plugins: [i18n, VueQueryPlugin], stubs },
});

const enterEdit = async () => {
  await fireEvent.click(screen.getByRole("button", { name: "Edit chapters" }));
  await nextTick();
};

describe("ChaptersPanel", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
    mocks.data.value = [];
    mocks.mutate.mockClear();
    mocks.mutateAsync.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Editing has no cancel any more: changes autosave as they are made, and the
  // only way out of edit mode is committing them.
  it("offers save as the only action while editing", async () => {
    renderPanel();
    await enterEdit();
    expect(screen.getByRole("textbox")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Save chapters" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel editing" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit chapters" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Import CUE file" })).toBeNull();
  });

  it("keeps save enabled for an empty draft and exits without a write when nothing changed", async () => {
    renderPanel();
    await enterEdit();

    const save = screen.getByRole("button", { name: "Save chapters" });
    expect(save).not.toBeDisabled();

    await fireEvent.click(save);
    await nextTick();

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("autosaves the draft 1500 ms after the last edit", async () => {
    // Date stays real: Vue drops a bubbling handler whose attach time equals the event stamp, and a frozen clock makes them equal.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    mocks.data.value = [{ time: 10, title: "Intro" }];
    renderPanel();
    await enterEdit();

    await fireEvent.update(screen.getByRole("textbox"), "00:05 - Changed");
    await nextTick();

    vi.advanceTimersByTime(1499);
    expect(mocks.mutate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(mocks.mutate).toHaveBeenCalledWith({ trackId: "t1", chapters: [{ time: 5, title: "Changed" }] });
  });

  it("does not write again on save when the autosave already persisted the draft", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    mocks.data.value = [{ time: 10, title: "Intro" }];
    renderPanel();
    await enterEdit();

    await fireEvent.update(screen.getByRole("textbox"), "00:05 - Changed");
    await nextTick();
    vi.advanceTimersByTime(1500);
    expect(mocks.mutate).toHaveBeenCalledTimes(1);

    // The query cache now reflects what the autosave wrote.
    mocks.data.value = [{ time: 5, title: "Changed" }];
    await nextTick();

    await fireEvent.click(screen.getByRole("button", { name: "Save chapters" }));
    await nextTick();

    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("leaves a failed CUE save to the save toast instead of calling the file unreadable", async () => {
    mocks.mutateAsync.mockRejectedValueOnce(new Error("quota"));
    renderPanel();

    fileDialog.onChange?.([new File([CUE], "album.cue")]);
    await flushPromises();

    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Failed to parse CUE file")).toBeNull();
  });
});
