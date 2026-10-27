import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor } from "@testing-library/vue";
import { flushPromises } from "@vue/test-utils";
import { shownToasts } from "@/test/toasts";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import { db } from "@/db";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { deleteTracksAndSync, updateTrackMetadataAndSync } from "@/queries/track.queries";
import { AlbumId, ArtistId, TrackId } from "@/types/ids";
import type { Track } from "@/types/track";
import TrackInfoPanel from "../TrackInfoPanel.vue";

const queries = vi.hoisted(() => ({ getTrackEntityById: vi.fn() }));
vi.mock("@/queries/track.queries", async importOriginal => ({
  ...(await importOriginal<typeof import("@/queries/track.queries")>()),
  getTrackEntityById: queries.getTrackEntityById,
}));
const deletion = vi.hoisted(() => ({ deleteWithUndo: vi.fn() }));
vi.mock("@/modules/tracks/composables/useTrackDeletion", () => ({
  useTrackDeletion: () => deletion,
}));
vi.mock("@/app/toaster", () => ({ toaster: { add: vi.fn() } }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }) }));
vi.mock("@/components/dialogs/summonDialog", () => ({ summonDialog: vi.fn() }));

const slotStub = { template: "<div><slot /></div>" };
const stubs = {
  Scrollable: slotStub,
  RightPanelHeader: slotStub,
  DropdownMenu: slotStub,
  DropdownMenuTrigger: slotStub,
  DropdownMenuContent: slotStub,
  DropdownMenuItem: slotStub,
};

const payloadTrack = (): Track => ({
  kind: "library",
  id: "t1" as Track["id"],
  title: "Glory Box",
  artist: "Portishead",
  artistIds: ["ar1" as Track["artistIds"][number]],
  albumId: "al1" as Track["albumId"],
  albumName: "Dummy",
  storagePath: "tracks/t1.mp3",
  source: TrackSource.LOCAL_INTERNAL,
  state: TrackState.READY,
  duration: 100,
  isLiked: false,
});

const entity = (overrides: Partial<TrackEntity>): TrackEntity => ({
  id: "t1",
  title: "Glory Box",
  artistName: "Portishead",
  albumTitle: "Dummy",
  artistIds: ["ar1"],
  albumId: "al1",
  tagIds: [],
  source: TrackSource.LOCAL_INTERNAL,
  storagePath: "tracks/t1.mp3",
  pinned: 0,
  state: TrackState.READY,
  duration: 100,
  format: {},
  playCount: 0,
  addedAt: 0,
  ...overrides,
} as TrackEntity);

const renderPanel = (track: Track) => render(TrackInfoPanel, {
  props: { payload: { track } },
  global: { plugins: [i18n, VueQueryPlugin], stubs },
});

const readStoredRows = async () => {
  const actual = await vi.importActual<typeof import("@/queries/track.queries")>("@/queries/track.queries");
  queries.getTrackEntityById.mockImplementation(actual.getTrackEntityById);
};

describe("TrackInfoPanel", () => {
  beforeEach(async () => {
    queries.getTrackEntityById.mockReset();
    i18n.global.locale.value = "en";
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    await db.artists.add({ id: ArtistId("ar1"), name: "Portishead", pinned: 1, addedAt: 1, updatedAt: 1 });
    await db.albums.add({ id: AlbumId("al1"), title: "Dummy", artistId: ArtistId("ar1"), pinned: 1, addedAt: 1, updatedAt: 1 });
  });

  it("shows the stored track over the payload snapshot once the detail query resolves", async () => {
    queries.getTrackEntityById.mockResolvedValue(entity({
      artistName: "Portishead, Beth Gibbons",
      artistIds: ["ar1", "ar2"],
    }));

    renderPanel(payloadTrack());

    expect(await screen.findByText("Portishead, Beth Gibbons")).toBeInTheDocument();
    expect(screen.getByText("ar1, ar2")).toBeInTheDocument();
    expect(screen.queryByText("Portishead")).not.toBeInTheDocument();
  });

  it("falls back to the payload while the detail query is pending", () => {
    queries.getTrackEntityById.mockReturnValue(new Promise(() => {}));

    renderPanel(payloadTrack());

    expect(screen.getByText("Portishead")).toBeInTheDocument();
  });

  it("shows a failed delete under the delete button instead of a toast", async () => {
    queries.getTrackEntityById.mockReturnValue(new Promise(() => {}));
    deletion.deleteWithUndo.mockRejectedValueOnce(new Error("quota"));
    renderPanel(payloadTrack());

    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    const deleteButton = deleteButtons[deleteButtons.length - 1]!;
    await fireEvent.click(deleteButton);
    await flushPromises();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Failed to delete track");
    expect(deleteButton.nextElementSibling).toBe(alert);
    expect(shownToasts("destructive")).toHaveLength(0);
  });

  it("TrackInfoPanel: follows the row after a write", async () => {
    await readStoredRows();
    await db.tracks.add(entity({ pinned: 1, artistIds: [ArtistId("ar1"), ArtistId("ar2")] }));
    renderPanel(payloadTrack());
    expect(await screen.findByText("ar1, ar2")).toBeInTheDocument();

    await updateTrackMetadataAndSync(new QueryClient(), payloadTrack(), {
      title: "Roads",
      artistNames: ["Portishead"],
      albumId: AlbumId("al1"),
    });

    expect(await screen.findByText("Roads")).toBeInTheDocument();
    expect(screen.queryByText("Glory Box")).not.toBeInTheDocument();
  });

  it("TrackInfoPanel: the storage path follows the local copy after a write", async () => {
    await readStoredRows();
    const remoteId = TrackId("nd:s1");
    await db.tracks.bulkAdd([
      entity({ id: remoteId, source: TrackSource.REMOTE_SUBSONIC, storagePath: "" }),
      entity({ id: TrackId("t-copy"), sourceRef: remoteId, storagePath: "tracks/t-copy.flac", pinned: 1 }),
    ]);
    renderPanel({ ...payloadTrack(), id: remoteId, source: TrackSource.REMOTE_SUBSONIC, storagePath: "" });
    expect(await screen.findByText("tracks/t-copy.flac")).toBeInTheDocument();

    await deleteTracksAndSync([TrackId("t-copy")]);

    await waitFor(() => expect(screen.queryByText("tracks/t-copy.flac")).not.toBeInTheDocument());
  });
});
