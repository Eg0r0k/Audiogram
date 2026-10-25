import type { Component } from "vue";
import { Spinner } from "@/components/ui/spinner";
import type { TrackMenuIcon } from "@/modules/tracks/lib/trackMenu";
import IconCloudOff from "~icons/tabler/cloud-off";
import IconDots from "~icons/tabler/dots";
import IconDownload from "~icons/tabler/download";
import IconExternalLink from "~icons/tabler/external-link";
import IconFileImport from "~icons/tabler/file-import";
import IconFileMusic from "~icons/tabler/file-music";
import IconFileText from "~icons/tabler/file-text";
import IconLike from "~icons/tabler/heart";
import IconLikedFilled from "~icons/tabler/heart-filled";
import IconInfoCircle from "~icons/tabler/info-circle";
import IconLibraryMinus from "~icons/tabler/library-minus";
import IconLibraryPlus from "~icons/tabler/library-plus";
import IconListNumbers from "~icons/tabler/list-numbers";
import IconPlayerTrackNext from "~icons/tabler/player-track-next";
import IconTrash from "~icons/tabler/trash";

export const TRACK_MENU_ICONS: Record<TrackMenuIcon, Component> = {
  playNext: IconPlayerTrackNext,
  addToQueue: IconListNumbers,
  showLyrics: IconFileText,
  like: IconLike,
  liked: IconLikedFilled,
  download: IconDownload,
  downloading: Spinner,
  removeDownload: IconCloudOff,
  more: IconDots,
  addToLibrary: IconLibraryPlus,
  removeFromLibrary: IconLibraryMinus,
  openExternal: IconExternalLink,
  lyrics: IconFileMusic,
  details: IconInfoCircle,
  remove: IconTrash,
  import: IconFileImport,
};
