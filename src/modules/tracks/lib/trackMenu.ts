import type { TrackContext } from "@/modules/tracks/components/menu/type";
import type { TrackMenuCaps } from "@/modules/tracks/composables/useTrackMenuCaps";
import type { DownloadRuntime } from "@/modules/downloads/store/downloads.store";
import type { AlbumId, ArtistId } from "@/types/ids";
import { isLibraryTrack, type PlayerTrack } from "@/types/track";
import { ephemeralFilePath, trackHasLyrics } from "./trackPredicates";

export type TrackMenuMode = "popper" | "sheet";

export type TrackMenuJob = Pick<DownloadRuntime, "status" | "downloaded" | "total">;

export interface TrackMenuFacts {
  context: TrackContext;
  track: PlayerTrack;
  caps: TrackMenuCaps;
  job: TrackMenuJob | null;
  isPlaylistOwner: boolean;
}

export interface TrackMenuInput extends TrackMenuFacts {
  mode: TrackMenuMode;
}

export type TrackMenuAction
  = | "playNext"
    | "addToQueue"
    | "showLyrics"
    | "toggleLike"
    | "attachLyrics"
    | "exportFile"
    | "downloadOffline"
    | "cancelOfflineDownload"
    | "removeDownload"
    | "addToLibrary"
    | "removeFromLibrary"
    | "openExternal"
    | "showDetails"
    | "importToLibrary"
    | "removeFromQueue"
    | "removeFromPlaylist"
    | "removeFromHistory";

export type TrackMenuIcon
  = | "playNext"
    | "addToQueue"
    | "showLyrics"
    | "like"
    | "liked"
    | "download"
    | "downloading"
    | "removeDownload"
    | "more"
    | "addToLibrary"
    | "removeFromLibrary"
    | "openExternal"
    | "lyrics"
    | "details"
    | "remove"
    | "import";

export interface TrackMenuItem {
  kind: "item";
  label: string;
  icon: TrackMenuIcon;
  action: TrackMenuAction;
  tone?: "destructive";
  progress?: number;
}

export interface TrackMenuSeparator {
  kind: "separator";
}

export interface TrackMenuSubmenu {
  kind: "submenu";
  id: string;
  label: string;
  icon: TrackMenuIcon;
  children: TrackMenuItem[];
}

export type TrackMenuSlot
  = | { kind: "slot"; slot: "addToPlaylist" }
    | { kind: "slot"; slot: "navigation"; artistIds: ArtistId[]; albumId: AlbumId | null };

export type TrackMenuEntry = TrackMenuItem | TrackMenuSeparator | TrackMenuSubmenu | TrackMenuSlot;

export interface HeaderTile {
  id: "like" | "file" | "lyrics";
  label: string;
  icon: TrackMenuIcon;
  action: TrackMenuAction;
  disabled: boolean;
  pressed?: boolean;
}

export interface TrackMenu {
  header: HeaderTile[];
  entries: TrackMenuEntry[];
}

type Section = (input: TrackMenuInput) => TrackMenuEntry[];

type OfflineState = "downloading" | "downloaded" | "downloadable" | "unavailable";

const when = <T>(condition: boolean, ...entries: T[]): T[] => (condition ? entries : []);

const item = (action: TrackMenuAction, label: string, icon: TrackMenuIcon): TrackMenuItem =>
  ({ kind: "item", label, icon, action });

const SEPARATOR: TrackMenuSeparator = { kind: "separator" };
const ADD_TO_PLAYLIST: TrackMenuSlot = { kind: "slot", slot: "addToPlaylist" };
const PLAY_NEXT = item("playNext", "track.contextMenu.playNext", "playNext");
const ADD_TO_QUEUE = item("addToQueue", "track.contextMenu.addToQueue", "addToQueue");
const SHOW_LYRICS = item("showLyrics", "track.contextMenu.showLyrics", "showLyrics");
const EXPORT_FILE = item("exportFile", "track.contextMenu.exportFile", "download");
const IMPORT_TO_LIBRARY = item("importToLibrary", "common.import.toLibrary", "import");
const DETAILS = item("showDetails", "track.contextMenu.details", "details");

const OFFLINE_ITEMS: Record<OfflineState, TrackMenuItem> = {
  downloading: item("cancelOfflineDownload", "track.contextMenu.cancelDownload", "downloading"),
  downloaded: item("removeDownload", "track.contextMenu.removeDownload", "removeDownload"),
  downloadable: item("downloadOffline", "track.contextMenu.download", "download"),
  unavailable: item("downloadOffline", "track.contextMenu.download", "download"),
};

const isLiked = (track: PlayerTrack) => isLibraryTrack(track) && track.isLiked;

const likeItem = ({ track }: TrackMenuInput) => (isLiked(track)
  ? item("toggleLike", "track.contextMenu.removeFromFavorites", "liked")
  : item("toggleLike", "track.contextMenu.addToFavorites", "like"));

const lyricsItem = ({ track }: TrackMenuInput) => (isLibraryTrack(track) && trackHasLyrics(track)
  ? item("attachLyrics", "track.contextMenu.replaceLyrics", "lyrics")
  : item("attachLyrics", "track.contextMenu.addLyrics", "lyrics"));

const offlineState = ({ caps, job }: TrackMenuInput): OfflineState => {
  if (job) return "downloading";
  if (caps.hasLocalCopy) return "downloaded";
  return caps.canDownload ? "downloadable" : "unavailable";
};

const downloadProgress = (job: TrackMenuJob | null): number | null => {
  if (job?.status !== "running" || !job.total) return null;
  return Math.min(100, Math.round((job.downloaded / job.total) * 100));
};

const offlineItems: Section = (input) => {
  const state = offlineState(input);
  if (input.caps.source === "local" || state === "unavailable") return [];
  // The sheet header holds a row's offline action; a stream has no header.
  if (input.mode === "sheet" && input.track.kind !== "ephemeral") return [];
  const progress = downloadProgress(input.job);
  return [progress === null ? OFFLINE_ITEMS[state] : { ...OFFLINE_ITEMS[state], progress }];
};

const sourceItems = ({ caps }: TrackMenuInput): TrackMenuItem[] => when(
  caps.source !== "local",
  caps.isInLibrary
    ? item("removeFromLibrary", "track.contextMenu.removeFromLibrary", "removeFromLibrary")
    : item("addToLibrary", "track.contextMenu.addToLibrary", "addToLibrary"),
  ...when(caps.canOpenExternal, item("openExternal", "track.contextMenu.openExternal", "openExternal")),
);

const moreSubmenu: Section = (input) => {
  const inSheet = input.mode === "sheet";
  const children = [
    ...sourceItems(input),
    ...when(input.caps.canExportFile && !(inSheet && input.caps.source === "local"), EXPORT_FILE),
    ...when(!inSheet, lyricsItem(input)),
  ];
  const more: TrackMenuSubmenu = { kind: "submenu", id: "more", label: "track.contextMenu.more", icon: "more", children };
  return when(children.length > 0, more);
};

const infoSection: Section = ({ track, caps }) => {
  const artistIds = isLibraryTrack(track) ? track.artistIds : [];
  const albumId = isLibraryTrack(track) && track.albumId ? track.albumId : null;
  const navigation: TrackMenuSlot = { kind: "slot", slot: "navigation", artistIds, albumId };
  return [
    SEPARATOR,
    ...when(artistIds.length > 0 || albumId !== null, navigation),
    // The details panel reads the Dexie row.
    ...when(caps.isPinned, DETAILS),
  ];
};

const destructive = (action: TrackMenuAction, label: string): TrackMenuEntry[] =>
  [SEPARATOR, { ...item(action, label, "remove"), tone: "destructive" }];

const play: Section = () => [PLAY_NEXT, ADD_TO_QUEUE];

const showLyrics: Section = () => [SHOW_LYRICS];

const librarySection: Section = input => [
  SEPARATOR,
  ...when(input.mode === "popper", likeItem(input)),
  ADD_TO_PLAYLIST,
  ...offlineItems(input),
  ...moreSubmenu(input),
  ...infoSection(input),
];

const streamSection: Section = input => [
  SEPARATOR,
  ...offlineItems(input),
  ...when(ephemeralFilePath(input.track) !== null, IMPORT_TO_LIBRARY),
];

const subjectSection: Section = input =>
  (input.track.kind === "ephemeral" ? streamSection(input) : librarySection(input));

const removeFromQueue: Section = () => destructive("removeFromQueue", "track.contextMenu.removeFromQueue");

const removeFromPlaylist: Section = input =>
  (input.isPlaylistOwner ? destructive("removeFromPlaylist", "track.contextMenu.removeFromPlaylist") : []);

const removeFromHistory: Section = () => destructive("removeFromHistory", "track.contextMenu.removeFromHistory");

const DEFAULT_MENU: readonly Section[] = [play, librarySection];

const CONTEXT_MENUS = {
  "default": DEFAULT_MENU,
  "album": DEFAULT_MENU,
  "artist": DEFAULT_MENU,
  "liked": DEFAULT_MENU,
  "search": DEFAULT_MENU,
  "search-top": DEFAULT_MENU,
  "yt-search": DEFAULT_MENU,
  "playlist": [play, librarySection, removeFromPlaylist],
  "history": [play, librarySection, removeFromHistory],
  "queue": [play, removeFromQueue, subjectSection],
  "current-track": [showLyrics, subjectSection],
} satisfies Record<TrackContext, readonly Section[]>;

const tile = (id: HeaderTile["id"], { label, icon, action }: TrackMenuItem, disabled = false): HeaderTile =>
  ({ id, label, icon, action, disabled });

// The file tile stays when nothing can be done, so the row keeps three tiles.
const fileTile = (input: TrackMenuInput): HeaderTile => {
  if (input.caps.source === "local") return tile("file", EXPORT_FILE, !input.caps.canExportFile);
  const state = offlineState(input);
  return tile("file", OFFLINE_ITEMS[state], state === "unavailable");
};

const headerTiles = (input: TrackMenuInput): HeaderTile[] => {
  if (input.mode !== "sheet" || input.track.kind === "ephemeral") return [];
  return [
    { ...tile("like", likeItem(input)), pressed: isLiked(input.track) },
    fileTile(input),
    tile("lyrics", lyricsItem(input)),
  ];
};

const withoutStraySeparators = (entries: TrackMenuEntry[]): TrackMenuEntry[] => {
  const kept = entries.filter((entry, index) =>
    entry.kind !== "separator" || (index > 0 && entries[index - 1].kind !== "separator"));
  const endsOnSeparator = kept.length > 0 && kept[kept.length - 1].kind === "separator";
  return endsOnSeparator ? kept.slice(0, -1) : kept;
};

export const buildTrackMenu = (input: TrackMenuInput): TrackMenu => ({
  header: headerTiles(input),
  entries: withoutStraySeparators(CONTEXT_MENUS[input.context].flatMap(section => section(input))),
});
