import type { SidebarFolderEntity } from "@/db/entities";
import type { LibraryItem } from "@/modules/library/types";
import DeleteConfirmDialog from "./DeleteConfirmDialog.vue";
import DeleteTrackDialog, { type DeleteTrackConfirmation } from "./DeleteTrackDialog.vue";
import DeleteTracksDialog from "./DeleteTracksDialog.vue";
import MoveToFolderDialog from "./MoveToFolderDialog.vue";
import ResetSettingsDialog from "@/pages/settings/components/ResetSettingsDialog.vue";
import type { DeleteConfirmData, DeleteConfirmResult } from "./deleteConfirm";

// The only place that binds a dialog key to a component. Domain code summons
// by key (ARCHITECTURE.md §6) and never imports the .vue itself.
export const DIALOGS = {
  deleteConfirm: DeleteConfirmDialog,
  deleteTrack: DeleteTrackDialog,
  deleteTracks: DeleteTracksDialog,
  moveToFolder: MoveToFolderDialog,
  resetSettings: ResetSettingsDialog,
} as const;

export interface DialogMap {
  deleteConfirm: { props: { data: DeleteConfirmData }; result: DeleteConfirmResult };
  deleteTrack: { props: { trackTitle: string }; result: DeleteTrackConfirmation };
  deleteTracks: { props: { count: number }; result: boolean };
  moveToFolder: { props: { item: LibraryItem; folders: SidebarFolderEntity[] }; result: string };
  resetSettings: { props: Record<string, never>; result: boolean };
}

export type DialogKey = keyof DialogMap;
