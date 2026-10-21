import { fireEvent, render, screen } from "@testing-library/vue";
import { beforeEach, describe, expect, it } from "vitest";
import { i18n } from "@/app/i18n";
import LoadMoreError from "../LoadMoreError.vue";

describe("LoadMoreError", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
  });

  it("says the next page failed and asks for it again on retry", async () => {
    const { emitted } = render(LoadMoreError, { global: { plugins: [i18n] } });

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load more");
    await fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(emitted().retry).toHaveLength(1);
  });
});
