import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { fireEvent, screen } from "@testing-library/vue";
import { flushPromises } from "@vue/test-utils";
import { closeDialogs, openForResult, renderDialogHost } from "@/test/dialogs";
import type { EditEntityDialogProps } from "../editEntityDialog";
import EditEntityDialog from "../EditEntityDialog.vue";

vi.mock("@/lib/files/requestFiles", () => ({
  requestFiles: vi.fn(async () => [new File(["x"], "notes.txt", { type: "text/plain" })]),
}));

const props = (save: EditEntityDialogProps["save"]): EditEntityDialogProps => ({
  title: "Edit album",
  coverAlt: "Cover",
  currentCoverUrl: null,
  primaryField: { id: "entity-title", label: "Title", placeholder: "Title", maxLength: 100, maxLengthMessage: "Too long", requiredMessage: "Required" },
  secondaryField: { id: "entity-description", label: "Description", placeholder: "", maxLength: 500, maxLengthMessage: "Too long" },
  initialPrimary: "Old",
  initialSecondary: "",
  coverErrorMessages: { invalidFormat: "Pick a JPG, PNG or WebP", readError: "Can't read the file", unknown: "Something broke" },
  save,
});

const open = async (save: EditEntityDialogProps["save"]) => {
  renderDialogHost();
  const promise = openForResult<true>(EditEntityDialog, props(save));
  await nextTick();
  await screen.findByText("Edit album");
  return { promise };
};

describe("EditEntityDialog", () => {
  afterEach(async () => {
    await closeDialogs();
  });

  it("shows a cover that does not fit right under the cover", async () => {
    await open(vi.fn());
    const coverButton = document.querySelector<HTMLButtonElement>("[data-slot=dialog-content] form button")!;

    await fireEvent.click(coverButton);
    await flushPromises();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Pick a JPG, PNG or WebP");
    expect(coverButton.nextElementSibling).toBe(alert);
  });

  it("shows a failed save next to the buttons and saves again on retry", async () => {
    const save = vi.fn()
      .mockRejectedValueOnce(new Error("quota"))
      .mockResolvedValueOnce(undefined);
    const { promise } = await open(save);

    await fireEvent.update(screen.getByLabelText("Title"), "New");
    await fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    await flushPromises();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't save the changes");
    expect(alert.nextElementSibling?.getAttribute("data-slot")).toBe("dialog-footer");

    await fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await expect(promise).resolves.toBe(true);
    expect(save).toHaveBeenCalledTimes(2);
  });
});
