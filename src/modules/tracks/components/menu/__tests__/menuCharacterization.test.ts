import { fireEvent, render } from "@testing-library/vue";
import { flushPromises } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { createPinia } from "pinia";
import { computed, defineComponent, h, onMounted, shallowRef, type PropType } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import {
  provideResponsiveMenu,
  type ResponsiveMenuContext,
  type ResponsiveMenuMode,
} from "@/components/ui/responsive-menu/context";
import { popperParts, sheetParts } from "@/components/ui/responsive-menu/sets";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { useDownloadsStore, type DownloadRuntime } from "@/modules/downloads/store/downloads.store";
import { sources, type SourceProvider, type SourceTrackDTO } from "@/modules/sources";
import { sourceTrackToDisplay } from "@/modules/sources/lib/display";
import { useTrackMenu } from "@/modules/tracks/composables/useTrackMenu";
import { localCopyQueries } from "@/queries/localCopy.queries";
import { AlbumId, ArtistId, PlaylistId, TrackId } from "@/types/ids";
import type { EphemeralTrack, PlayerTrack, Track } from "@/types/track";
import {
  ndAlbumId,
  ndArtistId,
  ndTrackId,
  ymAlbumId,
  ymArtistId,
  ymTrackId,
  ytTrackId,
  type SourceKind,
} from "@/types/track-ref";
import { useTrackMenuContent } from "../composables/useTrackMenuContent";
import TrackMenuEntries from "../TrackMenuEntries.vue";
import TrackMenuSheetHeader from "../TrackMenuSheetHeader.vue";
import type { TrackContext, TrackMenuSubject } from "../type";
import { provideTrackMenuComponents } from "../useTrackMenuComponents";

const slotData = vi.hoisted(() => ({
  playlists: [] as { id: string; name: string }[] | "pending",
  artistsPending: false,
  artistNames: { "ar-1": "Artist One", "ar-2": "Artist Two" } as Record<string, string>,
}));

vi.mock("@/queries/playlist.queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/queries/playlist.queries")>();
  return {
    ...actual,
    playlistQueries: {
      ...actual.playlistQueries,
      all: () => ({
        queryKey: ["menu-characterization", "playlists"],
        queryFn: () => (slotData.playlists === "pending"
          ? new Promise<never>(() => undefined)
          : Promise.resolve(slotData.playlists)),
      }),
    },
  };
});

vi.mock("@/queries/artist.queries", async importOriginal => ({
  ...(await importOriginal<typeof import("@/queries/artist.queries")>()),
  getArtistsByIds: (ids: string[]) => (slotData.artistsPending
    ? new Promise<never>(() => undefined)
    : Promise.resolve(ids.map(id => ({ id, name: slotData.artistNames[id] })))),
}));

vi.mock("@/modules/tracks/composables/useTrackContextActions", () => {
  const keys = [
    "play", "playNext", "addToQueue", "showDetails", "showLyrics", "toggleLike", "attachLyrics",
    "addToPlaylist", "removeFromQueue", "removeFromPlaylist", "removeFromHistory", "goToArtist",
    "goToAlbum", "exportFile", "downloadOffline", "cancelOfflineDownload", "removeDownload",
    "addToLibrary", "removeFromLibrary", "openExternal",
  ];
  return { useTrackContextActions: () => Object.fromEntries(keys.map(key => [key, () => undefined])) };
});

vi.mock("@/modules/tracks/composables/useEphemeralImport", async () => {
  const { computed: derive, ref, toValue } = await import("vue");
  const { ephemeralFilePath } = await import("@/modules/tracks/lib/trackPredicates");
  return {
    useEphemeralImport: (track: unknown) => ({
      importPath: derive(() => ephemeralFilePath(toValue(track) as PlayerTrack | null)),
      isRunning: ref(false),
      importCurrent: () => Promise.resolve(),
    }),
  };
});

vi.mock("@/modules/tracks/composables/useTrackRowCover", async () => {
  const { computed: derive } = await import("vue");
  return { useTrackRowCover: () => derive(() => "/img/fallback.svg") };
});

type Entry = string | SubEntry;
interface SubEntry { sub: string; items: Entry[] }
interface Tile { label: string; disabled: boolean; pressed?: boolean }
interface MenuView { header: Tile[]; entries: Entry[] }

interface Fixture {
  subject: PlayerTrack | TrackMenuSubject;
  remoteId?: TrackId;
  localCopy?: boolean;
  job?: DownloadRuntime;
}

interface MenuInput {
  context: TrackContext;
  mode: ResponsiveMenuMode;
  fixture: Fixture;
  isPlaylistOwner?: boolean;
}

interface Scenario extends MenuInput {
  name: string;
  expected: MenuView;
}

const fakeProvider = (id: SourceKind, download: boolean) =>
  ({ id, capabilities: { download } }) as unknown as SourceProvider;

sources.register(fakeProvider("nd", true));
sources.register(fakeProvider("yt", true));
// No real provider refuses downloads today; ym stands in for one that would.
sources.register(fakeProvider("ym", false));

const PLAYLISTS = [{ id: "pl-1", name: "Road trip" }, { id: "pl-2", name: "Focus" }];

const libraryTrack = (fields: Partial<Track> & Pick<Track, "id" | "title">): Track => ({
  kind: "library",
  artist: "Artist One",
  artistIds: [],
  albumId: AlbumId(""),
  albumName: "",
  storagePath: "",
  source: TrackSource.LOCAL_INTERNAL,
  state: TrackState.READY,
  pinned: 1,
  duration: 100,
  isLiked: false,
  ...fields,
});

const stream = (id: string, dto: SourceTrackDTO): EphemeralTrack => ({
  kind: "ephemeral",
  id,
  title: dto.title,
  artist: "Uploader",
  source: { type: "url", url: `https://stream.example.test/${id}` },
  sourceDto: dto,
});

const downloadJob = (
  trackId: TrackId,
  status: DownloadRuntime["status"],
  downloaded: number,
  total: number | null,
): DownloadRuntime => ({ jobId: `job-${trackId}`, trackId, status, downloaded, total, cancelling: false });

const localTrack: Fixture = {
  subject: libraryTrack({
    id: TrackId("t-local"),
    title: "Local song",
    artistIds: [ArtistId("ar-1")],
    albumId: AlbumId("al-1"),
    albumName: "Album",
    storagePath: "tracks/t-local.mp3",
  }),
};

const localTrackWithLyrics: Fixture = {
  subject: libraryTrack({
    id: TrackId("t-lyrics"),
    title: "Sung song",
    artistIds: [ArtistId("ar-1"), ArtistId("ar-2")],
    albumId: AlbumId("al-1"),
    albumName: "Album",
    storagePath: "tracks/t-lyrics.mp3",
    lyricsPath: "lyrics/t-lyrics.lrc",
    isLiked: true,
  }),
};

const localRowWithoutFile: Fixture = {
  subject: libraryTrack({ id: TrackId("t-radio"), title: "Radio row", source: TrackSource.REMOTE_HLS }),
};

const pinnedNdTrack: Fixture = {
  subject: libraryTrack({
    id: ndTrackId("101"),
    title: "Pinned song",
    artistIds: [ndArtistId("ar-101")],
    source: TrackSource.REMOTE_SUBSONIC,
  }),
  remoteId: ndTrackId("101"),
};

const ndTrackWithLocalCopy: Fixture = {
  subject: libraryTrack({
    id: ndTrackId("102"),
    title: "Copied song",
    artistIds: [ndArtistId("ar-102")],
    albumId: ndAlbumId("al-102"),
    source: TrackSource.REMOTE_SUBSONIC,
  }),
  remoteId: ndTrackId("102"),
  localCopy: true,
};

const ndTrackDownloading: Fixture = {
  subject: libraryTrack({
    id: ndTrackId("103"),
    title: "Downloading song",
    artistIds: [ndArtistId("ar-103")],
    albumId: ndAlbumId("al-103"),
    source: TrackSource.REMOTE_SUBSONIC,
  }),
  remoteId: ndTrackId("103"),
  job: downloadJob(ndTrackId("103"), "running", 42, 100),
};

const pinnedTrackWithoutDownload: Fixture = {
  subject: libraryTrack({
    id: ymTrackId("301"),
    title: "Undownloadable song",
    artistIds: [ymArtistId("ar-301")],
    albumId: ymAlbumId("al-301"),
    source: TrackSource.REMOTE_YM,
  }),
  remoteId: ymTrackId("301"),
};

const ytDtoNotInLibrary: Fixture = {
  subject: sourceTrackToDisplay({ id: ytTrackId("vid-1"), title: "Catalog video", artistName: "Uploader" }),
  remoteId: ytTrackId("vid-1"),
};

const ndDtoWithAlbum: Fixture = {
  subject: sourceTrackToDisplay({
    id: ndTrackId("201"),
    title: "Server song",
    artistName: "Artist One",
    albumId: ndAlbumId("al-201"),
  }),
  remoteId: ndTrackId("201"),
};

const streamWithCatalogId: Fixture = {
  subject: stream("eph-yt", { id: ytTrackId("vid-2"), title: "Streamed video" }),
  remoteId: ytTrackId("vid-2"),
};

const streamQueuedForDownload: Fixture = {
  ...streamWithCatalogId,
  job: downloadJob(ytTrackId("vid-2"), "queued", 0, null),
};

const streamDownloadingUnknownSize: Fixture = {
  ...streamWithCatalogId,
  job: downloadJob(ytTrackId("vid-2"), "running", 1000, null),
};

const streamFromSourceWithoutDownload: Fixture = {
  subject: stream("eph-ym", { id: ymTrackId("302"), title: "Streamed song" }),
  remoteId: ymTrackId("302"),
};

const openWithFile: Fixture = {
  subject: {
    kind: "ephemeral",
    id: "eph-file",
    title: "Opened file",
    source: { type: "path", path: "C:/Music/Opened file.flac" },
  },
};

const streamWithoutIdentity: Fixture = {
  subject: {
    kind: "ephemeral",
    id: "eph-radio",
    title: "Live radio",
    source: { type: "url", url: "https://radio.example.test/live" },
  },
};

const SAVE_AS = "Save as\u2026";
const ADD_TO_PLAYLIST: SubEntry = {
  sub: "Add to playlist",
  items: ["[Search playlist...]", "|", "Create playlist", "|", "Road trip", "Focus"],
};
const GO_TO_ARTISTS: SubEntry = { sub: "Go to artists", items: ["Artist One", "Artist Two"] };

const DEFAULT_LOCAL_POPPER: Entry[] = [
  "Play next",
  "Add to queue",
  "|",
  "Add to favorites",
  ADD_TO_PLAYLIST,
  { sub: "More", items: [SAVE_AS, "Add lyrics"] },
  "|",
  "Go to artist",
  "Go to album",
  "Details",
];

const LOCAL_TILES: Tile[] = [
  { label: "Add to favorites", disabled: false, pressed: false },
  { label: SAVE_AS, disabled: false },
  { label: "Add lyrics", disabled: false },
];

const fakeParts = {
  Item: defineComponent({
    inheritAttrs: false,
    setup: (_, { slots, attrs }) => () => h("div", { "data-entry": "item", "data-tone": attrs.color }, slots.default?.()),
  }),
  Separator: defineComponent(() => () => h("hr", { "data-entry": "separator" })),
  // Opens on mount, so submenus that load their children on open show them.
  Sub: defineComponent({
    emits: ["update:open"],
    setup: (_, { slots, emit }) => {
      onMounted(() => emit("update:open", true));
      return () => h("div", { "data-entry": "sub" }, slots.default?.());
    },
  }),
  SubTrigger: defineComponent((_, { slots }) => () => h("div", { "data-entry": "trigger" }, slots.default?.())),
  SubContent: defineComponent({
    inheritAttrs: false,
    setup: (_, { slots }) => () => h("div", { "data-entry": "content" }, slots.default?.()),
  }),
};

const SlotStub = defineComponent((_, { slots }) => () => h("div", slots.default?.()));

const menuContext = (mode: ResponsiveMenuMode): ResponsiveMenuContext => ({
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

// Mirrors the shells: the header slot exists only in the sheet.
const Host = defineComponent({
  props: { input: { type: Object as PropType<MenuInput>, required: true } },
  setup(props) {
    const { mode } = props.input;
    provideResponsiveMenu(menuContext(mode));
    provideTrackMenuComponents(fakeParts);
    const { input, actions } = useTrackMenuContent({
      context: () => props.input.context,
      playlistId: () => PlaylistId("pl-1"),
      isPlaylistOwner: () => props.input.isPlaylistOwner ?? false,
    });
    return () => {
      const facts = input.value;
      return [
        h("div", { "data-testid": "sheet-header" }, facts && mode === "sheet"
          ? [h(TrackMenuSheetHeader, { input: facts, actions })]
          : []),
        h("div", { "data-testid": "menu-entries" }, facts ? [h(TrackMenuEntries, { input: facts, actions })] : []),
      ];
    };
  },
});

const text = (node: Node) => (node.textContent ?? "").replace(/\s+/g, " ").trim();

const readEntries = (root: Element): Entry[] => Array.from(root.childNodes).flatMap((node): Entry[] => {
  if (node.nodeType === Node.TEXT_NODE) {
    const value = text(node);
    return value ? [`(${value})`] : [];
  }
  if (!(node instanceof Element)) return [];
  const kind = node.getAttribute("data-entry");
  if (kind === "item") {
    return [node.getAttribute("data-tone") === "destructive" ? `${text(node)} [destructive]` : text(node)];
  }
  if (kind === "separator") return ["|"];
  if (kind === "sub") {
    const trigger = node.querySelector("[data-entry=trigger]");
    const content = node.querySelector("[data-entry=content]");
    return [{ sub: trigger ? text(trigger) : "", items: content ? readEntries(content) : [] }];
  }
  if (node.getAttribute("data-slot") === "spinner") return ["(loading)"];
  if (node instanceof HTMLInputElement) return [`[${node.placeholder}]`];
  return readEntries(node);
});

const readHeader = (root: Element): Tile[] => Array.from(root.querySelectorAll("label")).map((label) => {
  const button = label.querySelector("button");
  const pressed = button?.getAttribute("aria-pressed") ?? null;
  return {
    label: text(label.querySelector("span") ?? label),
    disabled: button?.getAttribute("aria-disabled") === "true",
    ...(pressed === null ? {} : { pressed: pressed === "true" }),
  };
});

const COPY_ROW = { id: TrackId("t-copy"), sourceRef: ndTrackId("102") } as TrackEntity;

const renderMenu = async (input: MenuInput) => {
  const pinia = createPinia();
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  const { fixture } = input;
  if (fixture.remoteId) {
    queryClient.setQueryData(localCopyQueries.byRemoteId(fixture.remoteId).queryKey, fixture.localCopy ? COPY_ROW : null);
  }
  if (fixture.job) useDownloadsStore(pinia).upsert(fixture.job);
  useTrackMenu().openMenu(fixture.subject, 0, { target: input.context });

  const view = render(Host, {
    props: { input },
    global: {
      plugins: [pinia, i18n, [VueQueryPlugin, { queryClient }]],
      stubs: { NuxtImage: true, DrawerTitle: SlotStub, DrawerDescription: SlotStub },
    },
  });
  await flushPromises();
  await flushPromises();
  await flushPromises();

  const read = (): MenuView => ({
    header: readHeader(view.getByTestId("sheet-header")),
    entries: readEntries(view.getByTestId("menu-entries")),
  });
  return { view, read };
};

const findSub = (entries: Entry[], label: string) =>
  entries.find((entry): entry is SubEntry => typeof entry !== "string" && entry.sub === label);

const scenarios: Scenario[] = [
  {
    name: "default popper: a local track without lyrics",
    context: "default",
    mode: "popper",
    fixture: localTrack,
    expected: { header: [], entries: DEFAULT_LOCAL_POPPER },
  },
  {
    name: "default sheet: a local track keeps like, Save as and lyrics in the header",
    context: "default",
    mode: "sheet",
    fixture: localTrack,
    expected: {
      header: LOCAL_TILES,
      entries: ["Play next", "Add to queue", "|", ADD_TO_PLAYLIST, "|", "Go to artist", "Go to album", "Details"],
    },
  },
  {
    name: "default popper: a liked local track with lyrics and two artists",
    context: "default",
    mode: "popper",
    fixture: localTrackWithLyrics,
    expected: {
      header: [],
      entries: [
        "Play next",
        "Add to queue",
        "|",
        "Remove from favorites",
        ADD_TO_PLAYLIST,
        { sub: "More", items: [SAVE_AS, "Replace lyrics"] },
        "|",
        GO_TO_ARTISTS,
        "Go to album",
        "Details",
      ],
    },
  },
  {
    name: "default sheet: a liked local track with lyrics shows a pressed like tile and Replace lyrics",
    context: "default",
    mode: "sheet",
    fixture: localTrackWithLyrics,
    expected: {
      header: [
        { label: "Remove from favorites", disabled: false, pressed: true },
        { label: SAVE_AS, disabled: false },
        { label: "Replace lyrics", disabled: false },
      ],
      entries: ["Play next", "Add to queue", "|", ADD_TO_PLAYLIST, "|", GO_TO_ARTISTS, "Go to album", "Details"],
    },
  },
  {
    name: "default sheet: a library row without a stored file disables Save as",
    context: "default",
    mode: "sheet",
    fixture: localRowWithoutFile,
    expected: {
      header: [
        { label: "Add to favorites", disabled: false, pressed: false },
        { label: SAVE_AS, disabled: true },
        { label: "Add lyrics", disabled: false },
      ],
      entries: ["Play next", "Add to queue", "|", ADD_TO_PLAYLIST, "|", "Details"],
    },
  },
  {
    name: "default popper: a pinned remote track without an album offers the download",
    context: "default",
    mode: "popper",
    fixture: pinnedNdTrack,
    expected: {
      header: [],
      entries: [
        "Play next",
        "Add to queue",
        "|",
        "Add to favorites",
        ADD_TO_PLAYLIST,
        "Download",
        { sub: "More", items: ["Remove from library", "Open in browser", "Add lyrics"] },
        "|",
        "Go to artist",
        "Details",
      ],
    },
  },
  {
    name: "default sheet: a pinned remote track moves the download into the header",
    context: "default",
    mode: "sheet",
    fixture: pinnedNdTrack,
    expected: {
      header: [
        { label: "Add to favorites", disabled: false, pressed: false },
        { label: "Download", disabled: false },
        { label: "Add lyrics", disabled: false },
      ],
      entries: [
        "Play next",
        "Add to queue",
        "|",
        ADD_TO_PLAYLIST,
        { sub: "More", items: ["Remove from library", "Open in browser"] },
        "|",
        "Go to artist",
        "Details",
      ],
    },
  },
  {
    name: "default popper: a remote catalog video outside the library has no info section",
    context: "default",
    mode: "popper",
    fixture: ytDtoNotInLibrary,
    expected: {
      header: [],
      entries: [
        "Play next",
        "Add to queue",
        "|",
        "Add to favorites",
        ADD_TO_PLAYLIST,
        "Download",
        { sub: "More", items: ["Add to library", "Open in browser", "Add lyrics"] },
      ],
    },
  },
  {
    name: "default popper: a remote track with a local copy offers removing it and Save as",
    context: "default",
    mode: "popper",
    fixture: ndTrackWithLocalCopy,
    expected: {
      header: [],
      entries: [
        "Play next",
        "Add to queue",
        "|",
        "Add to favorites",
        ADD_TO_PLAYLIST,
        "Remove download",
        { sub: "More", items: ["Remove from library", "Open in browser", SAVE_AS, "Add lyrics"] },
        "|",
        "Go to artist",
        "Go to album",
        "Details",
      ],
    },
  },
  {
    name: "default sheet: a remote track with a local copy keeps Save as in More",
    context: "default",
    mode: "sheet",
    fixture: ndTrackWithLocalCopy,
    expected: {
      header: [
        { label: "Add to favorites", disabled: false, pressed: false },
        { label: "Remove download", disabled: false },
        { label: "Add lyrics", disabled: false },
      ],
      entries: [
        "Play next",
        "Add to queue",
        "|",
        ADD_TO_PLAYLIST,
        { sub: "More", items: ["Remove from library", "Open in browser", SAVE_AS] },
        "|",
        "Go to artist",
        "Go to album",
        "Details",
      ],
    },
  },
  {
    name: "default popper: a running download shows its progress on the cancel item",
    context: "default",
    mode: "popper",
    fixture: ndTrackDownloading,
    expected: {
      header: [],
      entries: [
        "Play next",
        "Add to queue",
        "|",
        "Add to favorites",
        ADD_TO_PLAYLIST,
        "Cancel download \u00b7 42%",
        { sub: "More", items: ["Remove from library", "Open in browser", "Add lyrics"] },
        "|",
        "Go to artist",
        "Go to album",
        "Details",
      ],
    },
  },
  {
    name: "default sheet: a running download turns the header file tile into cancel",
    context: "default",
    mode: "sheet",
    fixture: ndTrackDownloading,
    expected: {
      header: [
        { label: "Add to favorites", disabled: false, pressed: false },
        { label: "Cancel download", disabled: false },
        { label: "Add lyrics", disabled: false },
      ],
      entries: [
        "Play next",
        "Add to queue",
        "|",
        ADD_TO_PLAYLIST,
        { sub: "More", items: ["Remove from library", "Open in browser"] },
        "|",
        "Go to artist",
        "Go to album",
        "Details",
      ],
    },
  },
  {
    name: "default popper: a remote track whose source cannot download has no offline item",
    context: "default",
    mode: "popper",
    fixture: pinnedTrackWithoutDownload,
    expected: {
      header: [],
      entries: [
        "Play next",
        "Add to queue",
        "|",
        "Add to favorites",
        ADD_TO_PLAYLIST,
        { sub: "More", items: ["Remove from library", "Open in browser", "Add lyrics"] },
        "|",
        "Go to artist",
        "Go to album",
        "Details",
      ],
    },
  },
  {
    name: "default sheet: a remote track whose source cannot download disables the header download",
    context: "default",
    mode: "sheet",
    fixture: pinnedTrackWithoutDownload,
    expected: {
      header: [
        { label: "Add to favorites", disabled: false, pressed: false },
        { label: "Download", disabled: true },
        { label: "Add lyrics", disabled: false },
      ],
      entries: [
        "Play next",
        "Add to queue",
        "|",
        ADD_TO_PLAYLIST,
        { sub: "More", items: ["Remove from library", "Open in browser"] },
        "|",
        "Go to artist",
        "Go to album",
        "Details",
      ],
    },
  },
  {
    name: "playlist popper: the owner can remove a local track from the playlist",
    context: "playlist",
    mode: "popper",
    fixture: localTrack,
    isPlaylistOwner: true,
    expected: {
      header: [],
      entries: [
        "Play next",
        "Add to queue",
        "|",
        "Add to favorites",
        ADD_TO_PLAYLIST,
        { sub: "More", items: [SAVE_AS, "Add lyrics"] },
        "|",
        "Go to artist",
        "Go to album",
        "Details",
        "|",
        "Remove from playlist [destructive]",
      ],
    },
  },
  {
    name: "playlist popper: a remote row of a playlist the user does not own has no remove and no details",
    context: "playlist",
    mode: "popper",
    fixture: ndDtoWithAlbum,
    isPlaylistOwner: false,
    expected: {
      header: [],
      entries: [
        "Play next",
        "Add to queue",
        "|",
        "Add to favorites",
        ADD_TO_PLAYLIST,
        "Download",
        { sub: "More", items: ["Add to library", "Open in browser", "Add lyrics"] },
        "|",
        "Go to album",
      ],
    },
  },
  {
    name: "history popper: a local track ends with Remove from history",
    context: "history",
    mode: "popper",
    fixture: localTrack,
    expected: {
      header: [],
      entries: [
        "Play next",
        "Add to queue",
        "|",
        "Add to favorites",
        ADD_TO_PLAYLIST,
        { sub: "More", items: [SAVE_AS, "Add lyrics"] },
        "|",
        "Go to artist",
        "Go to album",
        "Details",
        "|",
        "Remove from history [destructive]",
      ],
    },
  },
  {
    name: "queue popper: a local track puts Remove from queue before the library section",
    context: "queue",
    mode: "popper",
    fixture: localTrack,
    expected: {
      header: [],
      entries: [
        "Play next",
        "Add to queue",
        "|",
        "Remove from queue [destructive]",
        "|",
        "Add to favorites",
        ADD_TO_PLAYLIST,
        { sub: "More", items: [SAVE_AS, "Add lyrics"] },
        "|",
        "Go to artist",
        "Go to album",
        "Details",
      ],
    },
  },
  {
    name: "queue sheet: a local track keeps like, Save as and lyrics in the header",
    context: "queue",
    mode: "sheet",
    fixture: localTrack,
    expected: {
      header: LOCAL_TILES,
      entries: [
        "Play next",
        "Add to queue",
        "|",
        "Remove from queue [destructive]",
        "|",
        ADD_TO_PLAYLIST,
        "|",
        "Go to artist",
        "Go to album",
        "Details",
      ],
    },
  },
  {
    name: "queue popper: a stream with a catalog id keeps only the queue items and the download",
    context: "queue",
    mode: "popper",
    fixture: streamWithCatalogId,
    expected: {
      header: [],
      entries: ["Play next", "Add to queue", "|", "Remove from queue [destructive]", "|", "Download"],
    },
  },
  {
    name: "queue sheet: a stream keeps its offline item in the list, without progress for an unknown size",
    context: "queue",
    mode: "sheet",
    fixture: streamDownloadingUnknownSize,
    expected: {
      header: [],
      entries: ["Play next", "Add to queue", "|", "Remove from queue [destructive]", "|", "Cancel download"],
    },
  },
  {
    name: "queue popper: an opened file gets the queue items and the import",
    context: "queue",
    mode: "popper",
    fixture: openWithFile,
    expected: {
      header: [],
      entries: ["Play next", "Add to queue", "|", "Remove from queue [destructive]", "|", "Import to library"],
    },
  },
  {
    name: "current-track popper: a local track starts with Show lyrics and has no queue items",
    context: "current-track",
    mode: "popper",
    fixture: localTrack,
    expected: {
      header: [],
      entries: [
        "Show lyrics",
        "|",
        "Add to favorites",
        ADD_TO_PLAYLIST,
        { sub: "More", items: [SAVE_AS, "Add lyrics"] },
        "|",
        "Go to artist",
        "Go to album",
        "Details",
      ],
    },
  },
  {
    name: "current-track sheet: a local track keeps like, Save as and lyrics in the header",
    context: "current-track",
    mode: "sheet",
    fixture: localTrack,
    expected: {
      header: LOCAL_TILES,
      entries: ["Show lyrics", "|", ADD_TO_PLAYLIST, "|", "Go to artist", "Go to album", "Details"],
    },
  },
  {
    name: "current-track popper: a stream with a catalog id gets the download and no queue items",
    context: "current-track",
    mode: "popper",
    fixture: streamWithCatalogId,
    expected: {
      header: [],
      entries: ["Show lyrics", "|", "Download"],
    },
  },
  {
    name: "current-track sheet: a stream has no header tiles and a queued download shows no progress",
    context: "current-track",
    mode: "sheet",
    fixture: streamQueuedForDownload,
    expected: {
      header: [],
      entries: ["Show lyrics", "|", "Cancel download"],
    },
  },
  {
    name: "current-track popper: an opened file offers the import",
    context: "current-track",
    mode: "popper",
    fixture: openWithFile,
    expected: {
      header: [],
      entries: ["Show lyrics", "|", "Import to library"],
    },
  },
  {
    name: "current-track popper: a stream with no identity shows only Show lyrics",
    context: "current-track",
    mode: "popper",
    fixture: streamWithoutIdentity,
    expected: { header: [], entries: ["Show lyrics"] },
  },
];

describe("track menu as the user sees it", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
    slotData.playlists = PLAYLISTS;
    slotData.artistsPending = false;
  });

  for (const scenario of scenarios) {
    it(scenario.name, async () => {
      const { read } = await renderMenu(scenario);

      expect(read()).toStrictEqual(scenario.expected);
    });
  }

  it.each(["album", "liked", "search", "search-top", "artist", "yt-search"] as const)(
    "renders the %s context exactly like the default one",
    async (context) => {
      const { read } = await renderMenu({ context, mode: "popper", fixture: localTrack });

      expect(read()).toStrictEqual({ header: [], entries: DEFAULT_LOCAL_POPPER });
    },
  );

  it("does not end the queue menu on a bare separator for a stream whose source cannot download", async () => {
    const { read } = await renderMenu({ context: "queue", mode: "popper", fixture: streamFromSourceWithoutDownload });

    expect(read()).toStrictEqual({
      header: [],
      entries: ["Play next", "Add to queue", "|", "Remove from queue [destructive]"],
    });
  });
});

describe("submenus that load their own content", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
    slotData.playlists = PLAYLISTS;
    slotData.artistsPending = false;
  });

  it("tells the user there are no playlists yet", async () => {
    slotData.playlists = [];
    const { read } = await renderMenu({ context: "default", mode: "popper", fixture: localTrack });

    expect(findSub(read().entries, "Add to playlist")).toStrictEqual({
      sub: "Add to playlist",
      items: ["[Search playlist...]", "|", "Create playlist", "|", "(You don't have any playlists yet)"],
    });
  });

  it("shows a spinner while the playlists load", async () => {
    slotData.playlists = "pending";
    const { read } = await renderMenu({ context: "default", mode: "popper", fixture: localTrack });

    expect(findSub(read().entries, "Add to playlist")).toStrictEqual({
      sub: "Add to playlist",
      items: ["[Search playlist...]", "|", "Create playlist", "|", "(loading)"],
    });
  });

  it("says no playlist matches the search", async () => {
    const { view, read } = await renderMenu({ context: "default", mode: "popper", fixture: localTrack });

    await fireEvent.update(view.getByPlaceholderText("Search playlist..."), "zzz");

    expect(findSub(read().entries, "Add to playlist")).toStrictEqual({
      sub: "Add to playlist",
      items: ["[Search playlist...]", "|", "Create playlist", "|", "(No playlists found)"],
    });
  });

  it("shows a spinner while the artists of a multi-artist track load", async () => {
    slotData.artistsPending = true;
    const { read } = await renderMenu({ context: "default", mode: "popper", fixture: localTrackWithLyrics });

    expect(findSub(read().entries, "Go to artists")).toStrictEqual({ sub: "Go to artists", items: ["(loading)"] });
  });
});
