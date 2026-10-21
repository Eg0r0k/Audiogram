import { afterEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { screen, fireEvent } from "@testing-library/vue";
import { closeDialogs, openForResult, renderDialogHost } from "@/test/dialogs";
import { summonDialog } from "../summonDialog";

const renderHost = renderDialogHost;

describe("summonDialog (by registry key)", () => {
  afterEach(async () => {
    await closeDialogs();
  });

  it("mounts the registered component and resolves with its typed result", async () => {
    renderHost();
    const promise = summonDialog("cancelImport", {}, { key: "t" });
    await nextTick();

    expect(await screen.findByText("Cancel import?")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "Cancel import" }));
    await expect(promise).resolves.toBe(true);
  });

  it("dedupes by key like the component-level summon", async () => {
    renderHost();
    const first = summonDialog("cancelImport", {}, { key: "same" });
    const second = summonDialog("cancelImport", {}, { key: "same" });
    expect(first).toBe(second);
  });
});
