import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import { i18n } from "@/app/i18n";
import CreateAlbumCard from "../CreateAlbumCard.vue";

const renderCard = () => render(CreateAlbumCard, {
  global: {
    plugins: [i18n],
    directives: { ripple: {} },
  },
});

describe("CreateAlbumCard", () => {
  it("renders as a labelled button", () => {
    i18n.global.locale.value = "en";
    renderCard();

    expect(screen.getByRole("button", { name: "Create album" })).toBeInTheDocument();
  });

  it("emits create on click", async () => {
    const { emitted } = renderCard();

    await fireEvent.click(screen.getByRole("button"));

    expect(emitted().create).toHaveLength(1);
  });

  it("emits create on Enter like the album cards", async () => {
    const { emitted } = renderCard();

    await fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });

    expect(emitted().create).toHaveLength(1);
  });
});
