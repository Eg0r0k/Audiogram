import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { fireEvent, screen } from "@testing-library/vue";
import { flushPromises } from "@vue/test-utils";
import { closeDialogs, openForResult, renderDialogHost } from "@/test/dialogs";
import EditAvatarDialog from "../EditAvatarDialog.vue";

vi.mock("@/lib/files/requestFiles", () => ({
  requestFiles: vi.fn(async () => [new File(["x"], "notes.txt", { type: "text/plain" })]),
}));
vi.mock("vue-cropperjs", () => ({ default: { name: "VueCropper", render: () => null } }));
vi.mock("@/styles/cropper.css", () => ({}));

describe("EditAvatarDialog", () => {
  afterEach(async () => {
    await closeDialogs();
  });

  it("shows a file that does not fit by the buttons, not above the picture", async () => {
    renderDialogHost();
    openForResult<Blob>(EditAvatarDialog, { imageSrc: "data:image/png;base64,AAAA" });
    await nextTick();

    await fireEvent.click(await screen.findByRole("button", { name: "Change" }));
    await flushPromises();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Invalid image format");
    expect(alert.nextElementSibling?.getAttribute("data-slot")).toBe("dialog-footer");
  });
});
