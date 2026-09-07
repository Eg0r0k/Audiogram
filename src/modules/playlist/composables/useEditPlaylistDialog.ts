import { useI18n } from "vue-i18n";
import { summonDialog } from "@/components/dialogs/summonDialog";
import type { EditEntitySubmitPayload } from "@/components/dialogs/editEntityDialog";
import type { PlaylistEntity } from "@/db/entities";
import { NAME_MAX_LENGTH, PLAYLIST_DESCRIPTION_MAX_LENGTH } from "@/lib/limits";
import type { PlaylistChanges } from "@/queries/playlist.queries";

/**
 * Opens the shared entity editor for one Playlist. `save` receives only what
 * changed and runs inside the dialog, which closes on success and stays open
 * (with the input) on failure. Resolves `true` once saved, `undefined` when
 * dismissed.
 */
export const useEditPlaylistDialog = () => {
  const { t } = useI18n();

  const toChanges = (playlist: PlaylistEntity, payload: EditEntitySubmitPayload): PlaylistChanges => {
    const changes: PlaylistChanges = {};
    const name = payload.primary.trim();
    if (name && name !== playlist.name) changes.name = name;
    const description = payload.secondary.trim();
    if (description !== (playlist.description ?? "")) changes.description = description;
    if (payload.cover.coverBlob) changes.coverBlob = payload.cover.coverBlob;
    else if (payload.cover.removeCover) changes.removeCover = true;
    return changes;
  };

  return (
    playlist: PlaylistEntity,
    currentCoverUrl: string | null | undefined,
    save: (changes: PlaylistChanges) => Promise<void>,
  ) => summonDialog("editEntity", {
    title: t("dialogs.editPlaylist.title"),
    coverAlt: "Playlist cover preview",
    currentCoverUrl,
    primaryField: {
      id: "playlist-name",
      label: t("dialogs.editPlaylist.playlistName"),
      placeholder: t("dialogs.editPlaylist.namePlaceholder"),
      maxLength: NAME_MAX_LENGTH,
      maxLengthMessage: t("dialogs.editPlaylist.validation.nameMaxLength", { max: NAME_MAX_LENGTH }),
      requiredMessage: t("dialogs.editPlaylist.validation.nameRequired"),
    },
    secondaryField: {
      id: "playlist-description",
      label: t("dialogs.editPlaylist.description"),
      placeholder: t("dialogs.editPlaylist.descriptionPlaceholder"),
      maxLength: PLAYLIST_DESCRIPTION_MAX_LENGTH,
      maxLengthMessage: t("dialogs.editPlaylist.validation.descriptionMaxLength", { max: PLAYLIST_DESCRIPTION_MAX_LENGTH }),
    },
    initialPrimary: playlist.name,
    initialSecondary: playlist.description ?? "",
    coverErrorMessages: {
      invalidFormat: t("dialogs.editPlaylist.errors.invalidFormat"),
      readError: t("dialogs.editPlaylist.errors.readError"),
      unknown: t("dialogs.editPlaylist.errors.unknown"),
    },
    save: payload => save(toChanges(playlist, payload)),
  }, { key: `edit:${playlist.id}` });
};
