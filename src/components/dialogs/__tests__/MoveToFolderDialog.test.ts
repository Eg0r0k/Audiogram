import { afterEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { screen, fireEvent } from "@testing-library/vue";
import type { SidebarFolderEntity } from "@/db/entities";
import type { LibraryItem } from "@/modules/library/types";
import MoveToFolderDialog from "../MoveToFolderDialog.vue";
import { closeDialogs, openForResult, renderDialogHost } from "@/test/dialogs";

const item: LibraryItem = {
  id: "al1", type: "album", title: "Nevermind", isPinned: false, addedAt: 1, to: "/", rounded: false,
};

const folder = (id: string, name: string): SidebarFolderEntity =>
  ({ id, name, items: [], addedAt: 1, updatedAt: 1 }) as unknown as SidebarFolderEntity;

const renderHost = renderDialogHost;

describe("MoveToFolderDialog (summoned)", () => {
  afterEach(async () => {
    await closeDialogs();
  });

  it("resolves with the id of the picked folder", async () => {
    renderHost();
    const promise = openForResult<string>(MoveToFolderDialog, {
      item,
      folders: [folder("f1", "Rock"), folder("f2", "Grunge")],
    });
    await nextTick();

    expect(await screen.findByText("Nevermind")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Grunge" }));
    await expect(promise).resolves.toBe("f2");
  });

  it("shows the empty hint when there are no folders", async () => {
    renderHost();
    openForResult<string>(MoveToFolderDialog, { item, folders: [] });
    await nextTick();

    expect(await screen.findByText("Create a folder first")).toBeInTheDocument();
  });
});
