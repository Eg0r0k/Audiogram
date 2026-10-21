import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { screen, fireEvent } from "@testing-library/vue";
import { VueQueryPlugin } from "@tanstack/vue-query";
import type { PlaylistId } from "@/types/ids";
import DeleteConfirmDialog from "../DeleteConfirmDialog.vue";
import { closeDialogs, openForResult, renderDialogHost } from "@/test/dialogs";
import type { DeleteConfirmData, DeleteConfirmResult } from "../deleteConfirm";

const DATA: DeleteConfirmData = {
  type: "playlist",
  id: "pl-1" as PlaylistId,
  name: "My Playlist",
  trackCount: 3,
};

const renderHost = renderDialogHost;

describe("DeleteConfirmDialog (summoned)", () => {
  afterEach(async () => {
    await closeDialogs();
  });

  it("keeps the tracks when the destructive action is confirmed as-is", async () => {
    renderHost();
    const promise = openForResult<DeleteConfirmResult>(DeleteConfirmDialog, { data: DATA });
    await nextTick();

    expect(await screen.findByText("My Playlist")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await expect(promise).resolves.toEqual({ deleteTracks: false });
  });

  it("reports the opt-in to delete the tracks inside", async () => {
    renderHost();
    const promise = openForResult<DeleteConfirmResult>(DeleteConfirmDialog, { data: DATA });
    await nextTick();
    await screen.findByText("My Playlist");

    await fireEvent.click(screen.getByRole("checkbox", { name: "Also delete the tracks inside" }));
    await fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await expect(promise).resolves.toEqual({ deleteTracks: true });
  });

  it("starts the track opt-in on where the container owns its tracks", async () => {
    renderHost();
    const promise = openForResult<DeleteConfirmResult>(DeleteConfirmDialog, {
      data: { ...DATA, defaultDeleteTracks: true },
    });
    await nextTick();
    await screen.findByText("My Playlist");

    await fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await expect(promise).resolves.toEqual({ deleteTracks: true });
  });

  it("hides the track opt-in when there are no tracks inside", async () => {
    renderHost();
    openForResult<DeleteConfirmResult>(DeleteConfirmDialog, {
      data: { ...DATA, trackCount: 0 },
    });
    await nextTick();
    await screen.findByText("My Playlist");

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("names the source and hides the track opt-in when deleting at the source", async () => {
    renderHost();
    openForResult<DeleteConfirmResult>(DeleteConfirmDialog, {
      data: { ...DATA, atSource: "Yandex Music" },
    });
    await nextTick();
    await screen.findByText("My Playlist");

    expect(screen.getByText(/Yandex Music/)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("names what is deleted in the title instead of asking whether the user is sure", async () => {
    renderHost();
    openForResult<DeleteConfirmResult>(DeleteConfirmDialog, { data: DATA });
    await nextTick();

    expect(await screen.findByText("Delete playlist “My Playlist”?")).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
    expect(screen.queryByText(/are you sure/i)).toBeNull();
  });

  it("warns that an artist takes their albums along", async () => {
    renderHost();
    openForResult<DeleteConfirmResult>(DeleteConfirmDialog, { data: { ...DATA, type: "artist", name: "Tester" } });
    await nextTick();

    expect(await screen.findByText("Delete artist “Tester”?")).toBeInTheDocument();
    expect(screen.getByText("Their albums will be deleted too. This cannot be undone.")).toBeInTheDocument();
  });

  it("resolves undefined when cancelled", async () => {
    renderHost();
    const promise = openForResult<DeleteConfirmResult>(DeleteConfirmDialog, { data: DATA });
    await nextTick();
    await screen.findByText("My Playlist");

    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await expect(promise).resolves.toBeUndefined();
  });
});
