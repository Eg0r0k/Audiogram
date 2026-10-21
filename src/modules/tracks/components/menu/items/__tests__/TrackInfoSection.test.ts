import { render } from "@testing-library/vue";
import { defineComponent, h } from "vue";
import { beforeEach, describe, expect, it } from "vitest";
import { i18n } from "@/app/i18n";
import type { TrackMenuCaps } from "@/modules/tracks/composables/useTrackMenuCaps";
import { ArtistId } from "@/types/ids";
import { provideTrackMenuComponents } from "../../useTrackMenuComponents";
import TrackInfoSection from "../TrackInfoSection.vue";

// A catalog video has no artist, no album and no row to detail: the section
// must vanish whole, separator included, instead of leaving a gap.

const renderSection = (props: Record<string, unknown>) => render(defineComponent({
  setup() {
    provideTrackMenuComponents({
      Item: defineComponent((_, { slots, attrs }) => () => h("button", attrs, slots.default?.())),
      Separator: defineComponent(() => () => h("hr")),
      Sub: defineComponent((_, { slots }) => () => h("div", slots.default?.())),
      SubTrigger: defineComponent((_, { slots }) => () => h("div", slots.default?.())),
      SubContent: defineComponent((_, { slots }) => () => h("div", slots.default?.())),
    });
    return () => h(TrackInfoSection, props);
  },
}), { global: { plugins: [i18n] } });

describe("TrackInfoSection", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
  });

  it("renders nothing, not even its separator, for an unpinned row without links", () => {
    const { container } = renderSection({ artistIds: [], albumId: "", caps: { isPinned: false } as TrackMenuCaps });

    expect(container.querySelector("hr, button")).toBeNull();
  });

  it("opens with a separator once any item is present", () => {
    const linksOnly = renderSection({ artistIds: [ArtistId("ar1")], caps: { isPinned: false } as TrackMenuCaps });
    const detailsOnly = renderSection({ artistIds: [], caps: null });

    expect(linksOnly.container.querySelectorAll("hr")).toHaveLength(1);
    expect(linksOnly.getByText("Go to artist")).toBeTruthy();
    expect(detailsOnly.container.querySelectorAll("hr")).toHaveLength(1);
    expect(detailsOnly.getByText("Details")).toBeTruthy();
  });
});
