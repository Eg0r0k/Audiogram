import type { SidebarFolderEntity } from "@/db/entities";
import type { LibraryItem } from "@/modules/library/types";
import DeleteConfirmDialog from "./DeleteConfirmDialog.vue";
import DeleteTrackDialog, { type DeleteTrackConfirmation } from "./DeleteTrackDialog.vue";
import DeleteTracksDialog from "./DeleteTracksDialog.vue";
import MoveToFolderDialog from "./MoveToFolderDialog.vue";
import ResetSettingsDialog from "@/pages/settings/components/ResetSettingsDialog.vue";
import ClearAllDataDialog from "@/pages/settings/components/ClearAllDataDialog.vue";
import ClearHistoryDialog from "@/pages/settings/components/stats/ClearHistoryDialog.vue";
import ExternalLinkDialog from "./ExternalLinkDialog.vue";
import CancelImportDialog from "./CancelImportDialog.vue";
import LibraryFolderNameDialog from "@/components/layout/sidebar/LibraryFolderNameDialog.vue";
import UnsavedChangesDialog from "@/modules/tracks/components/edit/UnsavedChangesDialog.vue";
import RemoveWatchedFolderDialog from "@/modules/watched-folders/components/RemoveWatchedFolderDialog.vue";
import type { DeleteConfirmData, DeleteConfirmResult } from "./deleteConfirm";

// The only place that binds a dialog key to a component. Domain code summons
// by key (ARCHITECTURE.md §6) and never imports the .vue itself.
export const DIALOGS = {
  deleteConfirm: DeleteConfirmDialog,
  deleteTrack: DeleteTrackDialog,
  deleteTracks: DeleteTracksDialog,
  moveToFolder: MoveToFolderDialog,
  resetSettings: ResetSettingsDialog,
  clearAllData: ClearAllDataDialog,
  clearHistory: ClearHistoryDialog,
  externalLink: ExternalLinkDialog,
  cancelImport: CancelImportDialog,
  folderName: LibraryFolderNameDialog,
  unsavedChanges: UnsavedChangesDialog,
  removeWatchedFolder: RemoveWatchedFolderDialog,
} as const;

export interface ClearAllDataStats {
  tracksCount: number;
  albumsCount: number;
  artistsCount: number;
  totalUsed: string;
}

export interface DialogMap {
  deleteConfirm: { props: { data: DeleteConfirmData }; result: DeleteConfirmResult };
  deleteTrack: { props: { trackTitle: string }; result: DeleteTrackConfirmation };
  deleteTracks: { props: { count: number }; result: boolean };
  moveToFolder: { props: { item: LibraryItem; folders: SidebarFolderEntity[] }; result: string };
  resetSettings: { props: Record<string, never>; result: boolean };
  /** `clear` runs inside the dialog; it resolves only once the action succeeded. */
  clearAllData: { props: { stats: ClearAllDataStats; clear: () => Promise<void> }; result: true };
  clearHistory: { props: { clear: () => Promise<void> }; result: true };
  externalLink: { props: { url: string }; result: true };
  cancelImport: { props: Record<string, never>; result: true };
  folderName: { props: { initialName: string; title: string }; result: string };
  unsavedChanges: { props: Record<string, never>; result: true };
  removeWatchedFolder: { props: { name: string }; result: true };
}

export type DialogKey = keyof DialogMap;
