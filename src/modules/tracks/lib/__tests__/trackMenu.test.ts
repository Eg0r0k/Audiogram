import { beforeEach, describe, expect, it } from "vitest";
import { i18n } from "@/app/i18n";
import { TrackSource, TrackState } from "@/db/entities";
import { TRACK_CONTEXTS, type TrackContext } from "@/modules/tracks/components/menu/type";
import type { TrackMenuCaps } from "@/modules/tracks/composables/useTrackMenuCaps";
import { AlbumId, ArtistId, TrackId } from "@/types/ids";
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
import {
  buildTrackMenu,
  type HeaderTile,
  type TrackMenu,
  type TrackMenuAction,
  type TrackMenuEntry,
  type TrackMenuItem,
  type TrackMenuJob,
  type TrackMenuMode,
} from "../trackMenu";

interface Subject {
  track: PlayerTrack;
  caps: TrackMenuCaps;
  job?: TrackMenuJob;
}

type Shown = string | { sub: string; items: Shown[] };
interface ShownTile { label: string; disabled: boolean; pressed?: boolean }
interface ShownMenu { header: ShownTile[]; entries: Shown[] }

interface Scenario {
  name: string;
  context: TrackContext;
  mode: TrackMenuMode;
  subject: Subject;
  isPlaylistOwner?: boolean;
  expected: ShownMenu;
}

const libraryTrack = (fields: Partial<Track> & Pick<Track, "id">): Track => ({
  kind: "library",
  title: "Song",
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

const ephemeral = (id: string, source: EphemeralTrack["source"]): EphemeralTrack => ({
  kind: "ephemeral",
  id,
  title: "Streamed",
  source,
});

const localCaps = (trackId: TrackId, fields: Partial<TrackMenuCaps> = {}): TrackMenuCaps => ({
  kind: "library",
  source: "local",
  trackId,
  isInLibrary: true,
  isPinned: true,
  hasLocalCopy: false,
  canExportFile: true,
  canDownload: false,
  canOpenExternal: false,
  ...fields,
});

const remoteCaps = (source: SourceKind, trackId: TrackId, fields: Partial<TrackMenuCaps> = {}): TrackMenuCaps => ({
  kind: "library",
  source,
  trackId,
  isInLibrary: true,
  isPinned: true,
  hasLocalCopy: false,
  canExportFile: false,
  canDownload: true,
  canOpenExternal: true,
  ...fields,
});

const catalogCaps = (source: SourceKind, trackId: TrackId, fields: Partial<TrackMenuCaps> = {}) =>
  remoteCaps(source, trackId, { kind: "remote", isInLibrary: false, isPinned: false, ...fields });

const streamCaps = (source: SourceKind, trackId: TrackId, fields: Partial<TrackMenuCaps> = {}) =>
  remoteCaps(source, trackId, { kind: "ephemeral", isInLibrary: false, isPinned: false, ...fields });

const NO_IDENTITY_CAPS: TrackMenuCaps = {
  kind: "ephemeral",
  source: "local",
  trackId: null,
  isInLibrary: false,
  isPinned: false,
  hasLocalCopy: false,
  canExportFile: false,
  canDownload: false,
  canOpenExternal: false,
};

const localTrack: Subject = {
  track: libraryTrack({
    id: TrackId("t-local"),
    artistIds: [ArtistId("ar-1")],
    albumId: AlbumId("al-1"),
    storagePath: "tracks/t-local.mp3",
  }),
  caps: localCaps(TrackId("t-local")),
};

const localTrackWithLyrics: Subject = {
  track: libraryTrack({
    id: TrackId("t-lyrics"),
    artistIds: [ArtistId("ar-1"), ArtistId("ar-2")],
    albumId: AlbumId("al-1"),
    storagePath: "tracks/t-lyrics.mp3",
    lyricsPath: "lyrics/t-lyrics.lrc",
    isLiked: true,
  }),
  caps: localCaps(TrackId("t-lyrics")),
};

const localRowWithoutFile: Subject = {
  track: libraryTrack({ id: TrackId("t-radio"), source: TrackSource.REMOTE_HLS }),
  caps: localCaps(TrackId("t-radio"), { canExportFile: false }),
};

const pinnedNdTrack: Subject = {
  track: libraryTrack({ id: ndTrackId("101"), artistIds: [ndArtistId("ar-101")], source: TrackSource.REMOTE_SUBSONIC }),
  caps: remoteCaps("nd", ndTrackId("101")),
};

const ndTrackWithLocalCopy: Subject = {
  track: libraryTrack({
    id: ndTrackId("102"),
    artistIds: [ndArtistId("ar-102")],
    albumId: ndAlbumId("al-102"),
    source: TrackSource.REMOTE_SUBSONIC,
  }),
  caps: remoteCaps("nd", ndTrackId("102"), { hasLocalCopy: true, canExportFile: true, canDownload: false }),
};

const ndTrackDownloading: Subject = {
  track: libraryTrack({
    id: ndTrackId("103"),
    artistIds: [ndArtistId("ar-103")],
    albumId: ndAlbumId("al-103"),
    source: TrackSource.REMOTE_SUBSONIC,
  }),
  caps: remoteCaps("nd", ndTrackId("103")),
  job: { status: "running", downloaded: 42, total: 100 },
};

const pinnedTrackWithoutDownload: Subject = {
  track: libraryTrack({
    id: ymTrackId("301"),
    artistIds: [ymArtistId("ar-301")],
    albumId: ymAlbumId("al-301"),
    source: TrackSource.REMOTE_YM,
  }),
  caps: remoteCaps("ym", ymTrackId("301"), { canDownload: false }),
};

const ytDtoNotInLibrary: Subject = {
  track: libraryTrack({ id: ytTrackId("vid-1"), pinned: 0, source: TrackSource.REMOTE_YT }),
  caps: catalogCaps("yt", ytTrackId("vid-1")),
};

const ndDtoWithAlbum: Subject = {
  track: libraryTrack({ id: ndTrackId("201"), pinned: 0, albumId: ndAlbumId("al-201"), source: TrackSource.REMOTE_SUBSONIC }),
  caps: catalogCaps("nd", ndTrackId("201")),
};

const streamWithCatalogId: Subject = {
  track: ephemeral("eph-yt", { type: "url", url: "https://stream.example.test/eph-yt" }),
  caps: streamCaps("yt", ytTrackId("vid-2")),
};

const streamQueuedForDownload: Subject = {
  ...streamWithCatalogId,
  job: { status: "queued", downloaded: 0, total: null },
};

const streamDownloadingUnknownSize: Subject = {
  ...streamWithCatalogId,
  job: { status: "running", downloaded: 1000, total: null },
};

const streamFromSourceWithoutDownload: Subject = {
  track: ephemeral("eph-ym", { type: "url", url: "https://stream.example.test/eph-ym" }),
  caps: streamCaps("ym", ymTrackId("302"), { canDownload: false }),
};

const openWithFile: Subject = {
  track: ephemeral("eph-file", { type: "path", path: "C:/Music/Opened file.flac" }),
  caps: NO_IDENTITY_CAPS,
};

const streamWithoutIdentity: Subject = {
  track: ephemeral("eph-radio", { type: "url", url: "https://radio.example.test/live" }),
  caps: NO_IDENTITY_CAPS,
};

const SUBJECTS = [
  localTrack,
  localTrackWithLyrics,
  localRowWithoutFile,
  pinnedNdTrack,
  ndTrackWithLocalCopy,
  ndTrackDownloading,
  pinnedTrackWithoutDownload,
  ytDtoNotInLibrary,
  ndDtoWithAlbum,
  streamWithCatalogId,
  streamQueuedForDownload,
  streamDownloadingUnknownSize,
  streamFromSourceWithoutDownload,
  openWithFile,
  streamWithoutIdentity,
];

const build = (
  { context, mode, subject, isPlaylistOwner = false }: Omit<Scenario, "name" | "expected">,
): TrackMenu => buildTrackMenu({
  context,
  mode,
  track: subject.track,
  caps: subject.caps,
  job: subject.job ?? null,
  isPlaylistOwner,
});

const t = (key: string) => i18n.global.t(key);

const showEntry = (entry: TrackMenuEntry): Shown => {
  switch (entry.kind) {
    case "separator":
      return "|";
    case "item":
      return [
        t(entry.label),
        entry.progress === undefined ? "" : ` \u00b7 ${entry.progress}%`,
        entry.tone ? ` [${entry.tone}]` : "",
      ].join("");
    case "submenu":
      return { sub: t(entry.label), items: entry.children.map(showEntry) };
    case "slot":
      return entry.slot === "addToPlaylist"
        ? PLAYLISTS
        : goTo(...entry.artistIds, ...(entry.albumId ? [entry.albumId] : []));
  }
};

const showTile = (tile: HeaderTile): ShownTile => ({
  label: t(tile.label),
  disabled: tile.disabled,
  ...(tile.pressed === undefined ? {} : { pressed: tile.pressed }),
});

const show = (menu: TrackMenu): ShownMenu => ({
  header: menu.header.map(showTile),
  entries: menu.entries.map(showEntry),
});

const items = (entries: TrackMenuEntry[]): TrackMenuItem[] => entries.flatMap((entry) => {
  if (entry.kind === "item") return [entry];
  if (entry.kind === "submenu") return entry.children;
  return [];
});

const actionsOf = (entries: TrackMenuEntry[]): TrackMenuAction[] => items(entries).map(item => item.action);

const SAVE_AS = "Save as\u2026";
const PLAYLISTS = "<add to playlist>";
const goTo = (...targets: string[]) => `<go to ${targets.join(", ")}>`;

const DEFAULT_LOCAL_POPPER: Shown[] = [
  "Play next",
  "Add to queue",
  "|",
  "Add to favorites",
  PLAYLISTS,
  { sub: "More", items: [SAVE_AS, "Add lyrics"] },
  "|",
  goTo("ar-1", "al-1"),
  "Details",
];

const LOCAL_TILES: ShownTile[] = [
  { label: "Add to favorites", disabled: false, pressed: false },
  { label: SAVE_AS, disabled: false },
  { label: "Add lyrics", disabled: false },
];

const scenarios: Scenario[] = [
  {
    name: "default popper: a local track without lyrics",
    context: "default",
    mode: "popper",
    subject: localTrack,
    expected: { header: [], entries: DEFAULT_LOCAL_POPPER },
  },
  {
    name: "default sheet: a local track keeps like, Save as and lyrics in the header",
    context: "default",
    mode: "sheet",
    subject: localTrack,
    expected: {
      header: LOCAL_TILES,
      entries: ["Play next", "Add to queue", "|", PLAYLISTS, "|", goTo("ar-1", "al-1"), "Details"],
    },
  },
  {
    name: "default popper: a liked local track with lyrics and two artists",
    context: "default",
    mode: "popper",
    subject: localTrackWithLyrics,
    expected: {
      header: [],
      entries: [
        "Play next",
        "Add to queue",
        "|",
        "Remove from favorites",
        PLAYLISTS,
        { sub: "More", items: [SAVE_AS, "Replace lyrics"] },
        "|",
        goTo("ar-1", "ar-2", "al-1"),
        "Details",
      ],
    },
  },
  {
    name: "default sheet: a liked local track with lyrics shows a pressed Remove from favorites tile and Replace lyrics",
    context: "default",
    mode: "sheet",
    subject: localTrackWithLyrics,
    expected: {
      header: [
        { label: "Remove from favorites", disabled: false, pressed: true },
        { label: SAVE_AS, disabled: false },
        { label: "Replace lyrics", disabled: false },
      ],
      entries: ["Play next", "Add to queue", "|", PLAYLISTS, "|", goTo("ar-1", "ar-2", "al-1"), "Details"],
    },
  },
  {
    name: "default sheet: a library row without a stored file disables Save as",
    context: "default",
    mode: "sheet",
    subject: localRowWithoutFile,
    expected: {
      header: [
        { label: "Add to favorites", disabled: false, pressed: false },
        { label: SAVE_AS, disabled: true },
        { label: "Add lyrics", disabled: false },
      ],
      entries: ["Play next", "Add to queue", "|", PLAYLISTS, "|", "Details"],
    },
  },
  {
    name: "default popper: a pinned remote track without an album offers the download",
    context: "default",
    mode: "popper",
    subject: pinnedNdTrack,
    expected: {
      header: [],
      entries: [
        "Play next",
        "Add to queue",
        "|",
        "Add to favorites",
        PLAYLISTS,
        "Download",
        { sub: "More", items: ["Remove from library", "Open in browser", "Add lyrics"] },
        "|",
        goTo(ndArtistId("ar-101")),
        "Details",
      ],
    },
  },
  {
    name: "default sheet: a pinned remote track moves the download into the header",
    context: "default",
    mode: "sheet",
    subject: pinnedNdTrack,
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
        PLAYLISTS,
        { sub: "More", items: ["Remove from library", "Open in browser"] },
        "|",
        goTo(ndArtistId("ar-101")),
        "Details",
      ],
    },
  },
  {
    name: "default popper: a remote catalog video outside the library has no info section",
    context: "default",
    mode: "popper",
    subject: ytDtoNotInLibrary,
    expected: {
      header: [],
      entries: [
        "Play next",
        "Add to queue",
        "|",
        "Add to favorites",
        PLAYLISTS,
        "Download",
        { sub: "More", items: ["Add to library", "Open in browser", "Add lyrics"] },
      ],
    },
  },
  {
    name: "default popper: a remote track with a local copy offers removing it and Save as",
    context: "default",
    mode: "popper",
    subject: ndTrackWithLocalCopy,
    expected: {
      header: [],
      entries: [
        "Play next",
        "Add to queue",
        "|",
        "Add to favorites",
        PLAYLISTS,
        "Remove download",
        { sub: "More", items: ["Remove from library", "Open in browser", SAVE_AS, "Add lyrics"] },
        "|",
        goTo(ndArtistId("ar-102"), ndAlbumId("al-102")),
        "Details",
      ],
    },
  },
  {
    name: "default sheet: a remote track with a local copy keeps Save as in More",
    context: "default",
    mode: "sheet",
    subject: ndTrackWithLocalCopy,
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
        PLAYLISTS,
        { sub: "More", items: ["Remove from library", "Open in browser", SAVE_AS] },
        "|",
        goTo(ndArtistId("ar-102"), ndAlbumId("al-102")),
        "Details",
      ],
    },
  },
  {
    name: "default popper: a running download shows its progress on the cancel item",
    context: "default",
    mode: "popper",
    subject: ndTrackDownloading,
    expected: {
      header: [],
      entries: [
        "Play next",
        "Add to queue",
        "|",
        "Add to favorites",
        PLAYLISTS,
        "Cancel download \u00b7 42%",
        { sub: "More", items: ["Remove from library", "Open in browser", "Add lyrics"] },
        "|",
        goTo(ndArtistId("ar-103"), ndAlbumId("al-103")),
        "Details",
      ],
    },
  },
  {
    name: "default sheet: a running download turns the header file tile into cancel",
    context: "default",
    mode: "sheet",
    subject: ndTrackDownloading,
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
        PLAYLISTS,
        { sub: "More", items: ["Remove from library", "Open in browser"] },
        "|",
        goTo(ndArtistId("ar-103"), ndAlbumId("al-103")),
        "Details",
      ],
    },
  },
  {
    name: "default popper: a remote track whose source cannot download has no offline item",
    context: "default",
    mode: "popper",
    subject: pinnedTrackWithoutDownload,
    expected: {
      header: [],
      entries: [
        "Play next",
        "Add to queue",
        "|",
        "Add to favorites",
        PLAYLISTS,
        { sub: "More", items: ["Remove from library", "Open in browser", "Add lyrics"] },
        "|",
        goTo(ymArtistId("ar-301"), ymAlbumId("al-301")),
        "Details",
      ],
    },
  },
  {
    name: "default sheet: a remote track whose source cannot download disables the header download",
    context: "default",
    mode: "sheet",
    subject: pinnedTrackWithoutDownload,
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
        PLAYLISTS,
        { sub: "More", items: ["Remove from library", "Open in browser"] },
        "|",
        goTo(ymArtistId("ar-301"), ymAlbumId("al-301")),
        "Details",
      ],
    },
  },
  {
    name: "playlist popper: the owner can remove a local track from the playlist",
    context: "playlist",
    mode: "popper",
    subject: localTrack,
    isPlaylistOwner: true,
    expected: {
      header: [],
      entries: [...DEFAULT_LOCAL_POPPER, "|", "Remove from playlist [destructive]"],
    },
  },
  {
    name: "playlist popper: a remote row of a playlist the user does not own has no remove and no details",
    context: "playlist",
    mode: "popper",
    subject: ndDtoWithAlbum,
    isPlaylistOwner: false,
    expected: {
      header: [],
      entries: [
        "Play next",
        "Add to queue",
        "|",
        "Add to favorites",
        PLAYLISTS,
        "Download",
        { sub: "More", items: ["Add to library", "Open in browser", "Add lyrics"] },
        "|",
        goTo(ndAlbumId("al-201")),
      ],
    },
  },
  {
    name: "history popper: a local track ends with Remove from history",
    context: "history",
    mode: "popper",
    subject: localTrack,
    expected: {
      header: [],
      entries: [...DEFAULT_LOCAL_POPPER, "|", "Remove from history [destructive]"],
    },
  },
  {
    name: "queue popper: a local track puts Remove from queue before the library section",
    context: "queue",
    mode: "popper",
    subject: localTrack,
    expected: {
      header: [],
      entries: [
        "Play next",
        "Add to queue",
        "|",
        "Remove from queue [destructive]",
        "|",
        "Add to favorites",
        PLAYLISTS,
        { sub: "More", items: [SAVE_AS, "Add lyrics"] },
        "|",
        goTo("ar-1", "al-1"),
        "Details",
      ],
    },
  },
  {
    name: "queue sheet: a local track keeps like, Save as and lyrics in the header",
    context: "queue",
    mode: "sheet",
    subject: localTrack,
    expected: {
      header: LOCAL_TILES,
      entries: [
        "Play next",
        "Add to queue",
        "|",
        "Remove from queue [destructive]",
        "|",
        PLAYLISTS,
        "|",
        goTo("ar-1", "al-1"),
        "Details",
      ],
    },
  },
  {
    name: "queue popper: a stream with a catalog id keeps only the queue items and the download",
    context: "queue",
    mode: "popper",
    subject: streamWithCatalogId,
    expected: {
      header: [],
      entries: ["Play next", "Add to queue", "|", "Remove from queue [destructive]", "|", "Download"],
    },
  },
  {
    name: "queue sheet: a stream keeps its offline item in the list, without progress for an unknown size",
    context: "queue",
    mode: "sheet",
    subject: streamDownloadingUnknownSize,
    expected: {
      header: [],
      entries: ["Play next", "Add to queue", "|", "Remove from queue [destructive]", "|", "Cancel download"],
    },
  },
  {
    name: "queue popper: an opened file gets the queue items and the import",
    context: "queue",
    mode: "popper",
    subject: openWithFile,
    expected: {
      header: [],
      entries: ["Play next", "Add to queue", "|", "Remove from queue [destructive]", "|", "Import to library"],
    },
  },
  {
    name: "queue popper: a stream whose source cannot download does not end on a separator",
    context: "queue",
    mode: "popper",
    subject: streamFromSourceWithoutDownload,
    expected: {
      header: [],
      entries: ["Play next", "Add to queue", "|", "Remove from queue [destructive]"],
    },
  },
  {
    name: "current-track popper: a local track starts with Show lyrics and has no queue items",
    context: "current-track",
    mode: "popper",
    subject: localTrack,
    expected: {
      header: [],
      entries: [
        "Show lyrics",
        "|",
        "Add to favorites",
        PLAYLISTS,
        { sub: "More", items: [SAVE_AS, "Add lyrics"] },
        "|",
        goTo("ar-1", "al-1"),
        "Details",
      ],
    },
  },
  {
    name: "current-track sheet: a local track keeps like, Save as and lyrics in the header",
    context: "current-track",
    mode: "sheet",
    subject: localTrack,
    expected: {
      header: LOCAL_TILES,
      entries: ["Show lyrics", "|", PLAYLISTS, "|", goTo("ar-1", "al-1"), "Details"],
    },
  },
  {
    name: "current-track popper: a stream with a catalog id gets the download and no queue items",
    context: "current-track",
    mode: "popper",
    subject: streamWithCatalogId,
    expected: { header: [], entries: ["Show lyrics", "|", "Download"] },
  },
  {
    name: "current-track sheet: a stream has no header tiles and a queued download shows no progress",
    context: "current-track",
    mode: "sheet",
    subject: streamQueuedForDownload,
    expected: { header: [], entries: ["Show lyrics", "|", "Cancel download"] },
  },
  {
    name: "current-track popper: an opened file offers the import and no queue items",
    context: "current-track",
    mode: "popper",
    subject: openWithFile,
    expected: { header: [], entries: ["Show lyrics", "|", "Import to library"] },
  },
  {
    name: "current-track popper: a stream with no identity shows only Show lyrics",
    context: "current-track",
    mode: "popper",
    subject: streamWithoutIdentity,
    expected: { header: [], entries: ["Show lyrics"] },
  },
];

const OFFLINE_ACTIONS: TrackMenuAction[] = ["downloadOffline", "cancelOfflineDownload", "removeDownload"];

describe("buildTrackMenu", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
  });

  for (const scenario of scenarios) {
    it(scenario.name, () => {
      expect(show(build(scenario))).toStrictEqual(scenario.expected);
    });
  }

  it.each(["album", "liked", "search", "search-top", "artist", "yt-search"] as const)(
    "builds the %s menu exactly like the default one",
    (context) => {
      for (const mode of ["popper", "sheet"] as const) {
        for (const subject of SUBJECTS) {
          expect(build({ context, mode, subject })).toStrictEqual(build({ context: "default", mode, subject }));
        }
      }
    },
  );

  it("never starts, ends or doubles a separator", () => {
    for (const context of TRACK_CONTEXTS) {
      for (const mode of ["popper", "sheet"] as const) {
        for (const subject of SUBJECTS) {
          for (const isPlaylistOwner of [true, false]) {
            const kinds = build({ context, mode, subject, isPlaylistOwner }).entries.map(entry => entry.kind);

            expect(kinds[0]).not.toBe("separator");
            expect(kinds.at(-1)).not.toBe("separator");
            expect(kinds.some((kind, index) => kind === "separator" && kinds[index + 1] === "separator")).toBe(false);
          }
        }
      }
    }
  });

  it("maps every TrackContext to a menu", () => {
    for (const context of TRACK_CONTEXTS) {
      const { entries } = build({ context, mode: "popper", subject: localTrack });

      expect(entries[0]).toMatchObject({
        kind: "item",
        action: context === "current-track" ? "showLyrics" : "playNext",
      });
      expect(actionsOf(entries)).toContain("showDetails");
    }
  });

  it("keeps the download decision the same in the list and the sheet header", () => {
    const remote = pinnedNdTrack.track;
    const decisions: { subject: Subject; action: TrackMenuAction | null }[] = [
      { subject: { track: remote, caps: remoteCaps("nd", ndTrackId("101")) }, action: "downloadOffline" },
      {
        subject: { track: remote, caps: remoteCaps("nd", ndTrackId("101")), job: { status: "queued", downloaded: 0, total: null } },
        action: "cancelOfflineDownload",
      },
      {
        subject: {
          track: remote,
          caps: remoteCaps("nd", ndTrackId("101"), { hasLocalCopy: true, canExportFile: true, canDownload: false }),
          job: { status: "running", downloaded: 1, total: 2 },
        },
        action: "cancelOfflineDownload",
      },
      {
        subject: { track: remote, caps: remoteCaps("nd", ndTrackId("101"), { hasLocalCopy: true, canExportFile: true, canDownload: false }) },
        action: "removeDownload",
      },
      { subject: { track: remote, caps: remoteCaps("nd", ndTrackId("101"), { canDownload: false }) }, action: null },
    ];

    for (const { subject, action } of decisions) {
      const listed = actionsOf(build({ context: "default", mode: "popper", subject }).entries)
        .filter(listedAction => OFFLINE_ACTIONS.includes(listedAction));
      const tile = build({ context: "default", mode: "sheet", subject }).header.find(header => header.id === "file");

      expect(listed).toStrictEqual(action ? [action] : []);
      expect(tile).toMatchObject(action ? { action, disabled: false } : { action: "downloadOffline", disabled: true });
    }
  });

  it("offers details only for a subject with a library row", () => {
    expect(actionsOf(build({ context: "default", mode: "popper", subject: pinnedNdTrack }).entries)).toContain("showDetails");
    expect(actionsOf(build({ context: "default", mode: "popper", subject: ndDtoWithAlbum }).entries)).not.toContain("showDetails");
  });

  it("offers Save as only when a file or a local copy exists", () => {
    const exportable = (subject: Subject) =>
      actionsOf(build({ context: "default", mode: "popper", subject }).entries).includes("exportFile");

    expect(exportable(localTrack)).toBe(true);
    expect(exportable(ndTrackWithLocalCopy)).toBe(true);
    expect(exportable(pinnedNdTrack)).toBe(false);
    expect(exportable(ytDtoNotInLibrary)).toBe(false);
  });

  it("drops the info section with its separator when nothing in it applies", () => {
    const { entries } = build({ context: "playlist", mode: "popper", subject: ytDtoNotInLibrary, isPlaylistOwner: true });

    expect(entries.map(showEntry).slice(-3)).toStrictEqual([
      { sub: "More", items: ["Add to library", "Open in browser", "Add lyrics"] },
      "|",
      "Remove from playlist [destructive]",
    ]);
  });

  it("serves a YouTube search hit the download through the shared offline action", () => {
    expect(actionsOf(build({ context: "yt-search", mode: "popper", subject: ytDtoNotInLibrary }).entries))
      .toContain("downloadOffline");
  });

  it("imports an opened file through its own action and never offers it for a library track", () => {
    for (const context of ["queue", "current-track"] as const) {
      expect(actionsOf(build({ context, mode: "popper", subject: openWithFile }).entries)).toContain("importToLibrary");
      expect(actionsOf(build({ context, mode: "popper", subject: localTrack }).entries)).not.toContain("importToLibrary");
    }
  });
});
