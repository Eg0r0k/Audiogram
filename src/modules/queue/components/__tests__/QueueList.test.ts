import { render, screen, within } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { ok } from "neverthrow";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import { TrackSource, TrackState } from "@/db/entities";
import type { PlayerTrack, Track } from "@/types/track";
import { QueueItemId } from "@/types/ids";
import type { QueueSourceLink } from "../../composables/useQueueSourceLink";
import { registerPlaybackPort, type PlaybackPort } from "../../lib/playback-port";
import { registerAutoplaySource } from "../../lib/queue-autoplay";
import { useQueueStore } from "../../store/queue.store";
import type { QueueItem } from "../../types";
import QueueList from "../QueueList.vue";

const source = vi.hoisted(() => ({ link: null as QueueSourceLink | null }));

vi.mock("../../composables/useQueueSourceLink", async () => {
  const { computed } = await import("vue");
  return { useQueueSourceLink: () => ({ link: computed(() => source.link) }) };
});

const slotStub = { template: "<div><slot /></div>" };
const stubs = {
  TrackContextMenu: slotStub,
  TrackDropdown: true,
  TrackRow: { props: ["track"], template: "<div data-testid=\"current-row\">{{ track.title }}</div>" },
  QueueUpNext: { template: "<div data-testid=\"up-next-list\" />" },
  QueueEmpty: { template: "<div data-testid=\"queue-empty\" />" },
  Link: { props: ["to"], template: "<a :href=\"to\"><slot /></a>" },
};

const port = {
  currentTrack: null,
  currentTime: 0,
  canSeek: false,
  isPlaybackIntended: false,
  checkPlayable: () => ok(undefined),
  presentTrack: vi.fn(),
  selectTrack: vi.fn(),
  playPlayerTrack: vi.fn(async () => {}),
  restartCurrent: vi.fn(async () => false),
  stop: vi.fn(),
  clearCurrentTrack: vi.fn(),
  seekTo: vi.fn(),
} satisfies PlaybackPort;

const libraryTrack = (id: string, duration: number): Track => ({
  kind: "library",
  id: id as Track["id"],
  title: `Track ${id}`,
  artist: "Artist",
  artistIds: [],
  albumId: "a1" as Track["albumId"],
  albumName: "Album",
  storagePath: `tracks/${id}.mp3`,
  source: TrackSource.LOCAL_INTERNAL,
  state: TrackState.READY,
  duration,
  isLiked: false,
});

const entry = (track: PlayerTrack, i: number): QueueItem => ({
  id: QueueItemId(`item-${i}`),
  track,
  source: { type: "manual" },
  addedAt: i,
});

const renderQueue = (tracks: PlayerTrack[], current: number) => {
  setActivePinia(createPinia());
  const items = tracks.map(entry);
  const queueStore = useQueueStore();
  queueStore.hydrate({ items, playbackOrder: null, currentItemId: items[current].id });
  render(QueueList, { global: { plugins: [i18n], stubs } });
  return queueStore;
};

const DOT = "\u00b7";

const sublineParts = () => {
  const subline = screen.getByRole("heading", { name: "Up Next" }).nextElementSibling;
  return Array.from(subline?.children ?? [], part => part.textContent?.trim());
};

describe("QueueList up next header", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
    source.link = null;
    registerAutoplaySource(null);
    registerPlaybackPort(port);
  });

  afterEach(() => {
    registerAutoplaySource(null);
    registerPlaybackPort(null);
    vi.clearAllMocks();
  });

  const queueWithUpcoming = () => [
    libraryTrack("t0", 100),
    libraryTrack("t1", 600),
    libraryTrack("t2", 200),
    { kind: "ephemeral", id: "eph-1", title: "Opened file", source: { type: "path", path: "C:/x.flac" } } satisfies PlayerTrack,
    libraryTrack("t3", 230),
  ];

  it("shows the source, the count and the total length of the upcoming tracks under Up Next", () => {
    source.link = { label: "All music", to: "/all-music" };
    renderQueue(queueWithUpcoming(), 1);

    expect(sublineParts()).toEqual(["From All music", DOT, "3 tracks", DOT, "7 min"]);
    const link = screen.getByRole("link", { name: "All music" });
    expect(link).toHaveAttribute("href", "/all-music");
    expect(link).toHaveClass("font-bold", "text-foreground");
    expect(screen.getByRole("heading", { name: "Now Playing" })).toBeInTheDocument();
  });

  it("leaves the source out when the queue has no source", () => {
    renderQueue(queueWithUpcoming(), 1);

    expect(sublineParts()).toEqual(["3 tracks", DOT, "7 min"]);
    expect(screen.queryByText(/From/)).toBeNull();
  });

  it("clears everything but the current track from the Up Next header", async () => {
    const queueStore = renderQueue(queueWithUpcoming(), 1);

    const clear = screen.getByRole("button", { name: "Clear" });
    expect(clear).toHaveAttribute("data-variant", "ghost");
    expect(clear).toHaveAttribute("data-color", "destructive");
    expect(clear.querySelector("svg")).toBeNull();

    await userEvent.click(clear);

    expect(queueStore.queue.map(item => item.track.id)).toEqual(["t1"]);
    expect(queueStore.currentIndex).toBe(0);
    expect(port.stop).not.toHaveBeenCalled();
    expect(port.playPlayerTrack).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Repeat queue" })).toBeInTheDocument();
  });
});

describe("QueueList tail row", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
    source.link = null;
    registerAutoplaySource(null);
    registerPlaybackPort(port);
  });

  afterEach(() => {
    registerAutoplaySource(null);
    registerPlaybackPort(null);
  });

  const threeTracks = () => [libraryTrack("t0", 100), libraryTrack("t1", 100), libraryTrack("t2", 100)];

  it("shows the last-in-queue row with Repeat queue when nothing comes next", () => {
    renderQueue(threeTracks(), 2);

    const row = screen.getByText("Last track in queue").closest<HTMLElement>(".h-16");
    expect(row).toBeInTheDocument();
    expect(within(row!).getByText("Then playback stops")).toBeInTheDocument();
    expect(within(row!).getByRole("button", { name: "Repeat queue" })).toBeInTheDocument();
    expect(row?.parentElement).toHaveClass("px-2");
    expect(screen.queryByText("Similar tracks")).toBeNull();
    expect(screen.queryByTestId("up-next-list")).toBeNull();
  });

  it("hides the count and duration on the last track and keeps the header height", () => {
    source.link = { label: "All music", to: "/all-music" };
    renderQueue(threeTracks(), 2);

    const heading = screen.getByRole("heading", { name: "Up Next" });
    expect(sublineParts()).toEqual(["From All music"]);
    expect(screen.queryByText(/tracks?$/)).toBeNull();
    expect(screen.queryByText(/min$/)).toBeNull();
    expect(heading.parentElement).toHaveClass("min-h-11");
  });

  it("leaves no caption under Up Next on the last track without a source", () => {
    renderQueue(threeTracks(), 2);

    const heading = screen.getByRole("heading", { name: "Up Next" });
    expect(heading.nextElementSibling).toBeNull();
    expect(heading.parentElement).toHaveClass("min-h-11");
  });

  it("turns on repeat all from the Repeat queue row", async () => {
    const queueStore = renderQueue(threeTracks(), 2);

    await userEvent.click(screen.getByRole("button", { name: "Repeat queue" }));

    expect(queueStore.repeatMode).toBe("all");
    expect(screen.queryByText("Last track in queue")).toBeNull();
    expect(screen.getByTestId("up-next-list")).toBeInTheDocument();
  });

  it("shows the autoplay row instead when similar tracks will follow", () => {
    registerAutoplaySource(vi.fn(async () => []));
    renderQueue(threeTracks(), 2);

    expect(screen.getByText("Similar tracks")).toBeInTheDocument();
    expect(screen.getByText("Autoplay adds them when this track ends")).toBeInTheDocument();
    expect(screen.queryByText("Last track in queue")).toBeNull();
    expect(screen.queryByRole("button", { name: "Repeat queue" })).toBeNull();
  });

  it("keeps the list without a tail row while tracks come next", () => {
    renderQueue(threeTracks(), 1);

    expect(screen.getByTestId("up-next-list")).toBeInTheDocument();
    expect(screen.queryByText("Last track in queue")).toBeNull();
    expect(screen.queryByText("Similar tracks")).toBeNull();
  });
});
