import { render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import RightPanelHeader from "../RightPanelHeader.vue";

describe("RightPanelHeader", () => {
  it("truncates the description to one line", () => {
    const description = "A very long track title that would otherwise wrap onto a second line, by Some Artist";
    render(RightPanelHeader, { props: { title: "Lyrics", description } });

    expect(screen.getByRole("heading", { name: "Lyrics" })).toHaveClass("truncate");
    expect(screen.getByText(description)).toHaveClass("truncate");
  });
});
