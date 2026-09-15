import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import { i18n } from "@/app/i18n";
import AddTrackRow from "../AddTrackRow.vue";

const renderRow = () => render(AddTrackRow, {
  global: {
    plugins: [i18n],
    directives: { ripple: {} },
  },
});

describe("AddTrackRow", () => {
  it("renders as a labelled button", () => {
    i18n.global.locale.value = "en";
    renderRow();

    expect(screen.getByRole("button", { name: "Add tracks" })).toBeInTheDocument();
  });

  it("emits add on click and on Enter like the track rows", async () => {
    const { emitted } = renderRow();

    await fireEvent.click(screen.getByRole("button"));
    await fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });

    expect(emitted().add).toHaveLength(2);
  });

  // The track context menu and selection mode find rows by this attribute;
  // the add row must stay invisible to both.
  it("is not a track row", () => {
    const { container } = renderRow();

    expect(container.querySelector("[data-track-row]")).toBeNull();
  });

  it("puts the plus in the index column and the label in the title column", () => {
    const { container } = renderRow();

    expect(container.querySelector(".index-col svg")).not.toBeNull();
    expect(container.querySelector(".first-col span")?.textContent).toBe("Add tracks");
  });
});
