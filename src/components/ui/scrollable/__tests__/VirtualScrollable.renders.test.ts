import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { flush, installLayoutStubs, LIST_LAYOUT, mountList, removeLayoutStubs, ROW_HEIGHT } from "./scrollable-fakes";

// The virtualizer notifies only when the visible range or isScrolling
// changes. Anything in the list's render that follows the scroll offset
// itself would rebuild every row's vnodes on every frame of a scroll.

beforeEach(() => {
  installLayoutStubs(LIST_LAYOUT);
});

afterEach(removeLayoutStubs);

describe("VirtualScrollable renders", () => {
  it("does not re-render its rows for a scroll that keeps the same rows on screen", async () => {
    const list = mountList();
    await flush();
    await list.scrollTo(30 * ROW_HEIGHT + 10);
    expect(list.wrapper.find("[data-index='30']").exists()).toBe(true);
    const before = list.rowRenders();

    await list.scrollTo(30 * ROW_HEIGHT + 15);
    await list.scrollTo(30 * ROW_HEIGHT + 25);

    expect(list.rowRenders()).toBe(before);
  });

  it("renders the rows that a longer scroll brings in", async () => {
    const list = mountList();
    await flush();

    await list.scrollTo(30 * ROW_HEIGHT);

    expect(list.wrapper.find("[data-index='30']").exists()).toBe(true);
  });
});
