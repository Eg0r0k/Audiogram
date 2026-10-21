import { render, screen } from "@testing-library/vue";
import { defineComponent, h } from "vue";
import { beforeEach, describe, expect, it } from "vitest";
import { i18n } from "@/app/i18n";
import type { TrackMenuCaps } from "@/modules/tracks/composables/useTrackMenuCaps";
import { provideTrackMenuComponents } from "../../useTrackMenuComponents";
import DetailsItem from "../DetailsItem.vue";

// The details panel reads the Dexie row, so a subject without one (a catalog
// row that was never pinned) has nothing to show.

const renderItem = (caps: Partial<TrackMenuCaps> | null) => render(defineComponent({
  setup() {
    provideTrackMenuComponents({
      Item: defineComponent((_, { slots, attrs }) => () => h("button", attrs, slots.default?.())),
      Separator: defineComponent(() => () => h("hr")),
      Sub: defineComponent((_, { slots }) => () => h("div", slots.default?.())),
      SubTrigger: defineComponent((_, { slots }) => () => h("div", slots.default?.())),
      SubContent: defineComponent((_, { slots }) => () => h("div", slots.default?.())),
    });
    return () => h(DetailsItem, { caps: caps as TrackMenuCaps | null });
  },
}), { global: { plugins: [i18n] } });

describe("DetailsItem", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
  });

  it("hides for a subject that has no library row", () => {
    renderItem({ isPinned: false });

    expect(screen.queryByText("Details")).toBeNull();
  });

  it("shows for a pinned row and for caps-less call sites", () => {
    renderItem({ isPinned: true });
    renderItem(null);

    expect(screen.getAllByText("Details")).toHaveLength(2);
  });
});
