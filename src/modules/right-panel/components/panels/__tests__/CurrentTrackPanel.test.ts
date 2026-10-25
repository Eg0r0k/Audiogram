import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { i18n } from "@/app/i18n";
import { TrackSource, TrackState } from "@/db/entities";
import type { PlayerTrack, Track } from "@/types/track";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { mascotCoverUrl } from "@/modules/covers/lib/placeholder";
import { registerAutoplaySource } from "@/modules/queue/lib/queue-autoplay";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import type { QueueItem, RepeatMode } from "@/modules/queue/types";
import { QueueItemId } from "@/types/ids";
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
  return { useMobilePlayerColor: () => ({ color: ref({ hex: "#3366cc", hsl: "hsl(220, 60%, 50%)" }) }) };
});
vi.mock("@/modules/tracks/composables/useTrackMenu", () => ({
  useTrackMenu: () => ({ openDropdown: vi.fn(), openMenu: vi.fn() }),
}));
vi.mock("@/modules/tracks/composables/useToggleTrackLike", () => ({
  useToggleTrackLike: () => ({ toggleTrackLike: vi.fn() }),
}));

const slotStub = { template: "<div><slot /></div>" };
const trackRowStub = {
  props: ["track", "subtitle", "menuIndex"],
  template: "<div data-testid=\"up-next-row\" :data-index=\"menuIndex\">{{ track.title }} / {{ subtitle ?? track.artist }}</div>",
};
const stubs = {
  Scrollable: slotStub,
  CrossfadeTransition: slotStub,
  RightPanelHeader: { template: "<header><slot name=\"trailing\" /></header>" },
  NuxtImage: true,
  MarqueeBlock: slotStub,
  TrackRow: trackRowStub,
  LyricsPreviewCard: true,
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

function libraryTrack(id = "t1", title = "Library"): Track {
  return {
    kind: "library",
    id: id as Track["id"],
    title,
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

describe("CurrentTrackPanel restore", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const skeletons = (container: Element) => container.querySelectorAll("[data-slot='skeleton']");

  it("shows a skeleton instead of Nothing playing while the queue restores", () => {
    setActivePinia(createPinia());
    useQueueStore().isRestoring = true;
    const { container } = render(CurrentTrackPanel, { global: { plugins: [i18n], stubs } });

    expect(screen.queryByText("Nothing playing")).toBeNull();
    expect(container.querySelector("nuxt-image-stub")).toBeNull();
    expect(skeletons(container).length).toBeGreaterThan(0);
  });

  it("shows Nothing playing once the restore finished without a track", async () => {
    setActivePinia(createPinia());
    const queueStore = useQueueStore();
    queueStore.isRestoring = true;
    const { container } = render(CurrentTrackPanel, { global: { plugins: [i18n], stubs } });
    vi.spyOn(crypto, "randomUUID").mockReturnValueOnce("idle-c-0000-0000-0000-000000000000");

    queueStore.isRestoring = false;
    await nextTick();

    expect(screen.getByText("Nothing playing")).toBeInTheDocument();
    expect(skeletons(container)).toHaveLength(0);
    expect(container.querySelector("nuxt-image-stub")?.getAttribute("src"))
      .toBe(mascotCoverUrl("idle-c-0000-0000-0000-000000000000"));
  });

  it("keeps the header button's space while hidden", async () => {
    const { container } = renderPanel(null);
    const button = container.querySelector("header button");

    expect(button).not.toBeNull();
    expect(button).toHaveClass("invisible");
    expect(button).toHaveAttribute("aria-hidden", "true");
    expect(button).toHaveAttribute("tabindex", "-1");
    expect(button).toBeDisabled();

    usePlayerStore().currentTrack = libraryTrack();
    await nextTick();

    expect(container.querySelector("header button")).toBe(button);
    expect(button).not.toHaveClass("invisible");
    expect(button).not.toHaveAttribute("aria-hidden");
    expect(button).not.toHaveAttribute("tabindex");
    expect(button).toBeEnabled();
  });
});

describe("CurrentTrackPanel up next", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
    registerAutoplaySource(null);
  });

  afterEach(() => {
    registerAutoplaySource(null);
  });

  const entry = (i: number): QueueItem => ({
    id: QueueItemId(`item-${i}`),
    track: libraryTrack(`t${i}`, `Track ${i}`),
    source: { type: "manual" },
    addedAt: i,
  });

  const renderQueue = (length: number, current: number, repeatMode: RepeatMode = "off") => {
    setActivePinia(createPinia());
    const items = Array.from({ length }, (_, i) => entry(i));
    const queueStore = useQueueStore();
    queueStore.hydrate({ items, playbackOrder: null, currentItemId: items[current].id });
    queueStore.repeatMode = repeatMode;
    usePlayerStore().currentTrack = items[current].track;
    render(CurrentTrackPanel, { global: { plugins: [i18n], stubs } });
    return queueStore;
  };

  const rows = () => screen.queryAllByTestId("up-next-row").map(row => row.textContent?.trim());

  it("offers Repeat queue on the last track without autoplay and switches repeat to all", async () => {
    const queueStore = renderQueue(3, 2);

    expect(screen.getByText("Last track in queue")).toBeInTheDocument();
    expect(screen.getByText("Then playback stops")).toBeInTheDocument();
    expect(rows()).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "Repeat queue" }));

    expect(queueStore.repeatMode).toBe("all");
    expect(rows()).toEqual(["Track 0 / Artist", "Track 1 / Artist"]);
    expect(screen.queryByText("Last track in queue")).toBeNull();
  });

  it("shows the similar-tracks row on the last track when autoplay continues", () => {
    registerAutoplaySource(vi.fn(async () => []));
    renderQueue(3, 2);

    expect(screen.getByText("Similar tracks")).toBeInTheDocument();
    expect(screen.getByText("Autoplay adds them when this track ends")).toBeInTheDocument();
    expect(screen.queryByText("Last track in queue")).toBeNull();
    expect(screen.queryByRole("button", { name: "Repeat queue" })).toBeNull();
    expect(rows()).toEqual([]);
  });

  it("shows the current track with Repeats this track on repeat one", () => {
    renderQueue(3, 1, "one");

    expect(rows()).toEqual(["Track 1 / Repeats this track"]);
    expect(screen.getByTestId("up-next-row")).toHaveAttribute("data-index", "1");
  });

  it("shows the first queue entries again on repeat all at the last track", () => {
    renderQueue(5, 4, "all");

    expect(rows()).toEqual(["Track 0 / Artist", "Track 1 / Artist", "Track 2 / Artist"]);
    expect(screen.queryAllByTestId("up-next-row").map(row => row.getAttribute("data-index"))).toEqual(["0", "1", "2"]);
  });
});

describe("CurrentTrackPanel idle cover", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
  });

  const coverSrc = (container: Element) => container.querySelector("nuxt-image-stub")?.getAttribute("src");

  it("shows a different mascot every time nothing is playing", async () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("idle-a-0000-0000-0000-000000000000")
      .mockReturnValueOnce("idle-b-0000-0000-0000-000000000000");
    const { container } = renderPanel(null);
    const playerStore = usePlayerStore();

    expect(coverSrc(container)).toBe(mascotCoverUrl("idle-a-0000-0000-0000-000000000000"));

    playerStore.currentTrack = libraryTrack();
    await nextTick();
    expect(coverSrc(container)).toBe("/img/fallback.svg");

    playerStore.currentTrack = null;
    await nextTick();
    expect(coverSrc(container)).toBe(mascotCoverUrl("idle-b-0000-0000-0000-000000000000"));
  });
});
