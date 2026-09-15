import { describe, expect, it } from "vitest";
import { h } from "vue";
import { render, screen } from "@testing-library/vue";
import { createI18n } from "vue-i18n";
import { AlbumId } from "@/types/ids";
import { provideTrackMenuComponents } from "../../useTrackMenuComponents";
import NavigationItems from "../NavigationItems.vue";

// A track imported without an album tag is persisted with an empty albumId
// (see track-persister), so "Go to album" would navigate nowhere.

const renderItems = (albumId: AlbumId | undefined) => {
  const i18n = createI18n({
    legacy: false,
    locale: "en",
    missingWarn: false,
    fallbackWarn: false,
    messages: { en: { track: { contextMenu: { goToAlbum: "Go to album", goToArtist: "Go to artist" } } } },
  });

  return render({
    components: { NavigationItems },
    props: { albumId: { type: String, default: undefined } },
    setup() {
      provideTrackMenuComponents({
        Item: { setup: (_, { slots }) => () => h("button", { type: "button" }, slots.default?.()) },
        Separator: { setup: () => () => h("hr") },
        Sub: { setup: (_, { slots }) => () => h("div", slots.default?.()) },
        SubTrigger: { setup: (_, { slots }) => () => h("div", slots.default?.()) },
        SubContent: { setup: (_, { slots }) => () => h("div", slots.default?.()) },
      } as never);
    },
    template: "<NavigationItems :album-id=\"albumId\" />",
  }, {
    props: { albumId },
    global: { plugins: [i18n] },
  });
};

describe("NavigationItems", () => {
  it("shows 'Go to album' for a track that belongs to an album", () => {
    renderItems(AlbumId("album-1"));

    expect(screen.getByText("Go to album")).toBeInTheDocument();
  });

  it("hides 'Go to album' when the track has no album", () => {
    renderItems(AlbumId(""));

    expect(screen.queryByText("Go to album")).toBeNull();
  });

  it("hides 'Go to album' for tracks without library identifiers", () => {
    renderItems(undefined);

    expect(screen.queryByText("Go to album")).toBeNull();
  });
});
