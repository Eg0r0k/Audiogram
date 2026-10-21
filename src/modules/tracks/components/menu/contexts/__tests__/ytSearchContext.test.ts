import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { defineComponent, h } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import { sourceTrackToDisplay } from "@/modules/sources/lib/display";
import type { TrackMenuCaps } from "@/modules/tracks/composables/useTrackMenuCaps";
import { ytTrackId } from "@/types/track-ref";
import { provideTrackMenuComponents } from "../../useTrackMenuComponents";
import type { ContextActions } from "../../type";
import { trackContextComponents } from "../index";

//
// A YouTube search hit is a catalog DTO like a row on a YouTube album page,
// so the search overlay's menu must offer the same actions on it, wired to
// the same shared actions.
//

const spies: Record<string, ReturnType<typeof vi.fn>> = {};
const actions = new Proxy({}, {
  get: (_, key: string) => (spies[key] ??= vi.fn()),
}) as ContextActions;

const catalogRow = sourceTrackToDisplay({
  id: ytTrackId("abc"),
  title: "Catalog song",
  artistName: "Someone",
});

const remoteCaps: TrackMenuCaps = {
  kind: "remote",
  source: "yt",
  trackId: ytTrackId("abc"),
  isInLibrary: false,
  isPinned: false,
  hasLocalCopy: false,
  canExportFile: false,
  canDownload: true,
  canOpenExternal: true,
};

const Host = defineComponent({
  setup() {
    provideTrackMenuComponents({
      Item: defineComponent((_, { slots, attrs }) => () => h("button", attrs, slots.default?.())),
      Separator: defineComponent(() => () => h("hr")),
      Sub: defineComponent((_, { slots }) => () => h("div", slots.default?.())),
      SubTrigger: defineComponent((_, { slots }) => () => h("div", slots.default?.())),
      SubContent: defineComponent((_, { slots }) => () => h("div", slots.default?.())),
    });
    return () => h(trackContextComponents["yt-search"], { track: catalogRow, actions, caps: remoteCaps });
  },
});

describe("yt-search track menu context", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
    for (const spy of Object.values(spies)) spy.mockReset();
  });

  it("renders a search hit with the same context as a YouTube album page row", () => {
    expect(trackContextComponents["yt-search"]).toBe(trackContextComponents.album);
  });

  it("downloads a search hit through the shared offline action", async () => {
    render(Host, {
      global: {
        plugins: [i18n],
        stubs: { LikeItem: true, AddToPlaylistSub: true, MoreSub: true, NavigationItems: true, DetailsItem: true },
      },
    });

    await userEvent.click(screen.getByRole("button", { name: "Download" }));

    expect(spies.downloadOffline).toHaveBeenCalledTimes(1);
  });
});
