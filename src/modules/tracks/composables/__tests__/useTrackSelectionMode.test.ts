import { describe, expect, it, vi } from "vitest";
import { computed, effectScope, nextTick, ref } from "vue";
import { TrackSource, TrackState } from "@/db/entities";
import type { Track } from "@/modules/player/types";
import { TrackId } from "@/types/ids";
import { useTrackSelectionMode } from "../useTrackSelectionMode";

const makeTrack = (id: string): Track => ({
  kind: "library",
  id: TrackId(id),
  title: id,
  artist: "Artist",
  artistIds: [],
  albumId: "a1" as Track["albumId"],
  albumName: "Album",
  storagePath: `tracks/${id}.mp3`,
  source: TrackSource.LOCAL_INTERNAL,
  state: TrackState.READY,
  duration: 100,
  isLiked: false,
});

const setup = (allIds: string[] = ["t1", "t2", "t3", "t4"]) => {
  const tracks = ref<Track[]>([makeTrack("t1"), makeTrack("t2")]);
  const total = ref(allIds.length);
  const resetKey = ref("title_asc|");
  const getAllIds = vi.fn(async () => allIds.map(TrackId));
  const scope = effectScope();
  const mode = scope.run(() => useTrackSelectionMode(tracks, ref<HTMLElement | null>(null), {
    getAllIds,
    total,
    resetKey: computed(() => resetKey.value),
  }))!;
  return { tracks, total, resetKey, getAllIds, mode, scope };
};

describe("useTrackSelectionMode", () => {
  it("enter(id) turns the mode on and selects that track", () => {
    const { mode } = setup();

    mode.enter(TrackId("t2"));

    expect(mode.isSelectMode.value).toBe(true);
    expect(mode.isSelected("t2")).toBe(true);
    expect(mode.selectedCount.value).toBe(1);
  });

  it("enter() without an id keeps an empty selection but the mode on", () => {
    const { mode } = setup();
    mode.enter();
    expect(mode.isSelectMode.value).toBe(true);
    expect(mode.selectedCount.value).toBe(0);
  });

  it("exit() clears the selection and turns the mode off", () => {
    const { mode } = setup();
    mode.enter(TrackId("t1"));

    mode.exit();

    expect(mode.isSelectMode.value).toBe(false);
    expect(mode.selectedCount.value).toBe(0);
  });

  it("an implicit selection (ctrl-click / long-press) turns the mode on", async () => {
    const { mode, tracks } = setup();

    mode.handleTrackSelect(tracks.value[0], new MouseEvent("click", { ctrlKey: true }));
    await nextTick();

    expect(mode.isSelectMode.value).toBe(true);
    expect(mode.isSelected("t1")).toBe(true);
  });

  it("selectAll pulls every id from getAllIds, beyond the loaded pages", async () => {
    const { mode, getAllIds } = setup();
    mode.enter();

    const pending = mode.selectAll();
    expect(mode.isSelectingAll.value).toBe(true);
    await pending;

    expect(getAllIds).toHaveBeenCalledTimes(1);
    expect(mode.isSelectingAll.value).toBe(false);
    expect(mode.selectedCount.value).toBe(4);
    expect(mode.isAllSelected.value).toBe(true);
  });

  it("isAllSelected drops as soon as one id is removed; deselectAll empties", async () => {
    const { mode } = setup();
    mode.enter();
    await mode.selectAll();

    mode.toggleById("t3");
    expect(mode.isAllSelected.value).toBe(false);

    mode.deselectAll();
    expect(mode.selectedCount.value).toBe(0);
    expect(mode.isSelectMode.value).toBe(true);
  });

  it("selected ids survive a list refetch that drops rows", async () => {
    const { mode, tracks } = setup();
    mode.enter();
    await mode.selectAll();

    tracks.value = [makeTrack("t1")];
    await nextTick();

    expect(mode.selectedCount.value).toBe(4);
  });

  it("changing resetKey exits the mode", async () => {
    const { mode, resetKey } = setup();
    mode.enter(TrackId("t1"));

    resetKey.value = "title_desc|";
    await nextTick();

    expect(mode.isSelectMode.value).toBe(false);
    expect(mode.selectedCount.value).toBe(0);
  });

  it("Escape exits the mode only while it is on", () => {
    const { mode } = setup();
    mode.enter(TrackId("t1"));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(mode.isSelectMode.value).toBe(false);
  });

  it("Escape leaves the mode alone while a reka overlay is open", () => {
    const { mode } = setup();
    mode.enter(TrackId("t1"));
    const layer = document.createElement("div");
    layer.setAttribute("data-dismissable-layer", "");
    document.body.appendChild(layer);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(mode.isSelectMode.value).toBe(true);

    layer.remove();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(mode.isSelectMode.value).toBe(false);
  });
});

describe("useTrackSelectionMode touch long-press", () => {
  const ROW_HEIGHT = 50;
  const LONG_PRESS_MS = 450;

  const touchEvent = (type: string, y: number, target: EventTarget): Event => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "touches", { value: type === "touchend" ? [] : [{ clientX: 10, clientY: y, target }] });
    return event;
  };

  const setupWithRows = async () => {
    const container = document.createElement("div");
    for (let i = 1; i <= 2; i++) {
      const row = document.createElement("div");
      row.dataset.trackId = `t${i}`;
      row.dataset.trackIndex = String(i - 1);
      container.appendChild(row);
    }
    document.body.appendChild(container);
    vi.spyOn(document, "elementFromPoint").mockImplementation(
      (_x: number, y: number) => container.children[Math.floor(y / ROW_HEIGHT)] ?? null,
    );
    Object.defineProperty(navigator, "vibrate", { value: vi.fn(), configurable: true });
    const tracks = ref<Track[]>([makeTrack("t1"), makeTrack("t2")]);
    const containerRef = ref<HTMLElement | null>(null);
    const scope = effectScope();
    const mode = scope.run(() => useTrackSelectionMode(tracks, containerRef, {
      getAllIds: async () => [],
      total: ref(2),
      resetKey: ref("k"),
    }))!;
    containerRef.value = container;
    await nextTick();
    const longPress = (index: number) => {
      const row = container.children[index]!;
      container.dispatchEvent(touchEvent("touchstart", index * ROW_HEIGHT + 25, row));
      vi.advanceTimersByTime(LONG_PRESS_MS);
      const menu = new Event("contextmenu", { bubbles: true, cancelable: true });
      row.dispatchEvent(menu);
      row.dispatchEvent(touchEvent("touchend", 0, row));
      return menu.defaultPrevented;
    };
    return { mode, longPress, scope, container };
  };

  it("outside the mode a long-press selects nothing and leaves the context menu alone", async () => {
    vi.useFakeTimers();
    try {
      const { mode, longPress, scope, container } = await setupWithRows();
      expect(longPress(0)).toBe(false);
      expect(mode.isSelectMode.value).toBe(false);
      expect(mode.selectedCount.value).toBe(0);
      scope.stop();
      container.remove();
    }
    finally {
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });

  it("inside the mode a long-press selects the row and swallows the context menu", async () => {
    vi.useFakeTimers();
    try {
      const { mode, longPress, scope, container } = await setupWithRows();
      mode.enter();
      expect(longPress(1)).toBe(true);
      expect(mode.isSelected("t2")).toBe(true);
      scope.stop();
      container.remove();
    }
    finally {
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });
});
