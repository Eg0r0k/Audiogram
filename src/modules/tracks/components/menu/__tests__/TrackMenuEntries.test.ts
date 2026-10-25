import { fireEvent, render, screen } from "@testing-library/vue";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { createPinia } from "pinia";
import { computed, defineComponent, h, shallowRef, type VNode } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import { provideResponsiveMenu, type ResponsiveMenuMode } from "@/components/ui/responsive-menu/context";
import { popperParts, sheetParts } from "@/components/ui/responsive-menu/sets";
import { TrackSource, TrackState } from "@/db/entities";
import { useTrackMenu } from "@/modules/tracks/composables/useTrackMenu";
import type { TrackMenuCaps } from "@/modules/tracks/composables/useTrackMenuCaps";
import type { TrackMenuFacts } from "@/modules/tracks/lib/trackMenu";
import { AlbumId } from "@/types/ids";
import type { Track } from "@/types/track";
import { ymTrackId, ytTrackId } from "@/types/track-ref";
import { useTrackMenuContent } from "../composables/useTrackMenuContent";
import TrackMenuEntries from "../TrackMenuEntries.vue";
import TrackMenuSheetHeader from "../TrackMenuSheetHeader.vue";
import type { TrackMenuActions } from "../type";
import { provideTrackMenuComponents } from "../useTrackMenuComponents";

const importCurrent = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("@/modules/tracks/composables/useEphemeralImport", () => ({
  useEphemeralImport: () => ({ importCurrent }),
}));

vi.mock("@/modules/tracks/composables/useTrackContextActions", () => ({
  useTrackContextActions: () => ({}),
}));

vi.mock("@/modules/tracks/composables/useTrackRowCover", async () => {
  const { computed: derive } = await import("vue");
  return { useTrackRowCover: () => derive(() => "/img/fallback.svg") };
});

const spies: Record<string, ReturnType<typeof vi.fn>> = {};
const actions = new Proxy({}, {
  get: (_, key: string) => (spies[key] ??= vi.fn()),
}) as TrackMenuActions;

const fakeParts = {
  Item: defineComponent((_, { slots, attrs }) => () => h("button", attrs, slots.default?.())),
  Separator: defineComponent(() => () => h("hr")),
  Sub: defineComponent((_, { slots }) => () => h("div", slots.default?.())),
  SubTrigger: defineComponent((_, { slots }) => () => h("div", slots.default?.())),
  SubContent: defineComponent((_, { slots }) => () => h("div", slots.default?.())),
};

const SlotStub = defineComponent((_, { slots }) => () => h("div", slots.default?.()));

const libraryTrack = (fields: Partial<Track> & Pick<Track, "id">): Track => ({
  kind: "library",
  title: "Song",
  artist: "Artist",
  artistIds: [],
  albumId: AlbumId(""),
  albumName: "",
  storagePath: "",
  source: TrackSource.LOCAL_INTERNAL,
  state: TrackState.READY,
  duration: 100,
  isLiked: false,
  ...fields,
});

const remoteCaps = (fields: Partial<TrackMenuCaps> & Pick<TrackMenuCaps, "source" | "trackId">): TrackMenuCaps => ({
  kind: "library",
  isInLibrary: true,
  isPinned: true,
  hasLocalCopy: false,
  canExportFile: false,
  canDownload: true,
  canOpenExternal: true,
  ...fields,
});

const facts = (track: Track, caps: TrackMenuCaps): TrackMenuFacts =>
  ({ context: "default", track, caps, job: null, isPlaylistOwner: false });

const renderInMenu = (mode: ResponsiveMenuMode, setup: () => () => VNode | null) => render(defineComponent(() => {
  provideResponsiveMenu({
    kind: "context",
    mode: computed(() => mode),
    parts: computed(() => (mode === "sheet" ? sheetParts : popperParts)),
    isOpen: computed(() => true),
    setOpen: () => undefined,
    modal: computed(() => true),
    trigger: shallowRef(null),
    triggerDisabled: shallowRef(false),
    popper: shallowRef(null),
  });
  provideTrackMenuComponents(fakeParts);
  return setup();
}), {
  global: {
    plugins: [createPinia(), i18n, [VueQueryPlugin, { queryClient: new QueryClient() }]],
    stubs: {
      AddToPlaylistSub: true,
      NavigationItems: true,
      NuxtImage: true,
      DrawerTitle: SlotStub,
      DrawerDescription: SlotStub,
    },
  },
});

describe("track menu renderer", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
    for (const spy of Object.values(spies)) spy.mockReset();
    importCurrent.mockClear();
  });

  it("runs the action of a clicked item, in the list and inside a submenu", async () => {
    const catalogVideo = facts(
      libraryTrack({ id: ytTrackId("vid-1"), pinned: 0 }),
      remoteCaps({ kind: "remote", source: "yt", trackId: ytTrackId("vid-1"), isInLibrary: false, isPinned: false }),
    );
    renderInMenu("popper", () => () => h(TrackMenuEntries, { input: catalogVideo, actions }));

    await fireEvent.click(screen.getByText("Download"));
    await fireEvent.click(screen.getByText("Open in browser"));

    expect(spies.downloadOffline).toHaveBeenCalledTimes(1);
    expect(spies.openExternal).toHaveBeenCalledTimes(1);
  });

  it("runs a header tile's action and leaves a disabled tile inert", async () => {
    const undownloadable = facts(
      libraryTrack({ id: ymTrackId("301"), source: TrackSource.REMOTE_YM }),
      remoteCaps({ source: "ym", trackId: ymTrackId("301"), canDownload: false }),
    );
    renderInMenu("sheet", () => () => h(TrackMenuSheetHeader, { input: undownloadable, actions }));

    await fireEvent.click(screen.getByLabelText("Add to favorites"));
    await fireEvent.click(screen.getByLabelText("Download"));

    expect(spies.toggleLike).toHaveBeenCalledTimes(1);
    expect(spies.downloadOffline).not.toHaveBeenCalled();
  });

  it("imports an opened file from the queue row menu through the ephemeral import", async () => {
    useTrackMenu().openMenu({
      kind: "ephemeral",
      id: "eph-file",
      title: "Opened file",
      source: { type: "path", path: "C:/Music/Opened file.flac" },
    }, 0, { target: "queue" });
    renderInMenu("popper", () => {
      const { input, actions: menuActions } = useTrackMenuContent({ context: "queue" });
      return () => (input.value ? h(TrackMenuEntries, { input: input.value, actions: menuActions }) : null);
    });

    await fireEvent.click(screen.getByText("Import to library"));

    expect(importCurrent).toHaveBeenCalledTimes(1);
  });
});
