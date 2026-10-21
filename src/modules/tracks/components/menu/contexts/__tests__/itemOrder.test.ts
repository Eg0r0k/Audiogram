import { render } from "@testing-library/vue";
import { defineComponent, h, type Component } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import { TrackSource, TrackState } from "@/db/entities";
import type { Track } from "@/modules/player/types";
import { provideTrackMenuComponents } from "../../useTrackMenuComponents";
import type { ContextActions } from "../../type";
import HistoryContext from "../HistoryContext.vue";
import PlaylistContext from "../PlaylistContext.vue";
import QueueContext from "../QueueContext.vue";

// Every context lays its items out the way the default one does: navigation
// first, details last, the zone's own destructive item after a separator.

const actions = new Proxy({}, { get: () => vi.fn() }) as ContextActions;

const track: Track = {
  kind: "library",
  id: "t1" as Track["id"],
  title: "Library",
  artist: "Artist",
  artistIds: [],
  albumId: "a1" as Track["albumId"],
  albumName: "Album",
  storagePath: "tracks/t1.mp3",
  source: TrackSource.LOCAL_INTERNAL,
  state: TrackState.READY,
  duration: 100,
  isLiked: false,
};

const stubs = {
  PlayItems: true,
  LikeItem: true,
  AddToPlaylistSub: true,
  OfflineItem: true,
  MoreSub: true,
  NavigationItems: true,
  DetailsItem: true,
};

const renderContext = (context: Component, props: Record<string, unknown>) => render(defineComponent({
  setup() {
    provideTrackMenuComponents({
      Item: defineComponent((_, { slots, attrs }) => () => h("button", attrs, slots.default?.())),
      Separator: defineComponent(() => () => h("hr")),
      Sub: defineComponent((_, { slots }) => () => h("div", slots.default?.())),
      SubTrigger: defineComponent((_, { slots }) => () => h("div", slots.default?.())),
      SubContent: defineComponent((_, { slots }) => () => h("div", slots.default?.())),
    });
    return () => h(context, { track, actions, caps: null, ...props });
  },
}), { global: { plugins: [i18n], stubs } });

const detailsAfterNavigation = (html: string) => {
  const navigation = html.indexOf("<navigation-items-stub");
  const details = html.indexOf("<details-item-stub");
  expect(navigation).toBeGreaterThan(-1);
  expect(details).toBeGreaterThan(navigation);
};

describe("track menu item order", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
  });

  it("playlist: details follow navigation", () => {
    const { container } = renderContext(PlaylistContext, { isOwner: true });
    detailsAfterNavigation(container.innerHTML);
  });

  it("history: details follow navigation", () => {
    const { container } = renderContext(HistoryContext, {});
    detailsAfterNavigation(container.innerHTML);
  });

  it("queue: details follow navigation", () => {
    const { container } = renderContext(QueueContext, { queueIndex: 0, queueLength: 1 });
    detailsAfterNavigation(container.innerHTML);
  });
});
