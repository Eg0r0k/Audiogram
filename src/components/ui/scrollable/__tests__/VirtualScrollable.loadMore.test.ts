import { render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import VirtualScrollable from "../VirtualScrollable.vue";

const rows = [{ id: "r1" }, { id: "r2" }];

const renderList = (loading: boolean) => render(VirtualScrollable, {
  props: { items: rows, loading },
  slots: { "load-more-error": "<p role=\"alert\">Couldn't load more</p>" },
});

describe("VirtualScrollable load-more error", () => {
  it("ends the list with the error the page passes", () => {
    renderList(false);

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load more");
  });

  it("hides the error while the next page is being loaded again", () => {
    renderList(true);

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
