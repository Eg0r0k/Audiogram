import { afterEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { screen } from "@testing-library/vue";
import { closeDialogs, openForResult, renderDialogHost } from "@/test/dialogs";
import RemoveWatchedFolderDialog from "../RemoveWatchedFolderDialog.vue";

describe("RemoveWatchedFolderDialog", () => {
  afterEach(async () => {
    await closeDialogs();
  });

  it("names the folder and says its tracks leave the library while the files stay", async () => {
    renderDialogHost();
    openForResult<true>(RemoveWatchedFolderDialog, { name: "Music" });
    await nextTick();

    expect(await screen.findByText("Stop watching “Music”?")).toBeInTheDocument();
    expect(screen.getByText("Its tracks will leave the library. The files on disk stay where they are.")).toBeInTheDocument();
  });
});
