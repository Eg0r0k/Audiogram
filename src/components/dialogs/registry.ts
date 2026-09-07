import type { ComponentInstance } from "vue";
import DeleteConfirmDialog from "./DeleteConfirmDialog.vue";
import DeleteTrackDialog, { type DeleteTrackConfirmation } from "./DeleteTrackDialog.vue";
import DeleteTracksDialog from "./DeleteTracksDialog.vue";
import MoveToFolderDialog from "./MoveToFolderDialog.vue";
import ExternalLinkDialog from "./ExternalLinkDialog.vue";
import CancelImportDialog from "./CancelImportDialog.vue";
import EditEntityDialog from "./EditEntityDialog.vue";
import EditAvatarDialog from "./EditAvatarDialog.vue";
import ResetSettingsDialog from "@/pages/settings/components/ResetSettingsDialog.vue";
import ClearAllDataDialog from "@/pages/settings/components/ClearAllDataDialog.vue";
import ClearHistoryDialog from "@/pages/settings/components/stats/ClearHistoryDialog.vue";
import LibraryFolderNameDialog from "@/components/layout/sidebar/LibraryFolderNameDialog.vue";
import UnsavedChangesDialog from "@/modules/tracks/components/edit/UnsavedChangesDialog.vue";
import RemoveWatchedFolderDialog from "@/modules/watched-folders/components/RemoveWatchedFolderDialog.vue";
import type { DeleteConfirmResult } from "./deleteConfirm";

/**
 * What each summoned dialog resolves with. Props are not declared here: they
 * are derived from the component itself (see {@link DialogMap}), so renaming
 * a prop in the SFC breaks every call site at type-check.
 */
interface DialogResults {
  deleteConfirm: DeleteConfirmResult;
  deleteTrack: DeleteTrackConfirmation;
  deleteTracks: boolean;
  moveToFolder: string;
  resetSettings: boolean;
  /** `clear` runs inside; resolves only once it succeeded. */
  clearAllData: true;
  clearHistory: true;
  externalLink: true;
  cancelImport: true;
  folderName: string;
  unsavedChanges: true;
  removeWatchedFolder: true;
  /** `save` runs inside; resolves only once it succeeded. */
  editEntity: true;
  /** Cropper over a picked image; resolves with the cropped blob. */
  editAvatar: Blob;
}

// The only place that binds a dialog key to a component. Domain code summons
// by key (ARCHITECTURE.md §6) and never imports the .vue itself. `satisfies`
// keeps this list and DialogResults in lockstep in both directions.
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
  editEntity: EditEntityDialog,
  editAvatar: EditAvatarDialog,
} as const satisfies Record<keyof DialogResults, unknown>;

export type DialogKey = keyof DialogResults;

/** A summoned component's own props; the host supplies `open` and its update. */
export type DialogProps<C> = Omit<ComponentInstance<C>["$props"], "open" | "onUpdate:open">;

export type DialogMap = {
  [K in DialogKey]: {
    props: DialogProps<(typeof DIALOGS)[K]>;
    result: DialogResults[K];
  };
};
