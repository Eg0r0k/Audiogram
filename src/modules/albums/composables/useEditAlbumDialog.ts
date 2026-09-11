import { useI18n } from "vue-i18n";
import { summonDialog } from "@/components/dialogs/summonDialog";
import type { EditEntitySubmitPayload } from "@/components/dialogs/editEntityDialog";
import type { AlbumEntity } from "@/db/entities";
import { ALBUM_DESCRIPTION_MAX_LENGTH, NAME_MAX_LENGTH } from "@/lib/limits";
import type { AlbumChanges } from "@/queries/album.queries";

/**
 * Opens the shared entity editor for one Album. `save` receives only what
 * changed and runs inside the dialog, which closes on success and stays open
 * (with the input) on failure. Resolves `true` once saved, `undefined` when
 * dismissed.
 */
export const useEditAlbumDialog = () => {
  const { t } = useI18n();

  const toChanges = (album: AlbumEntity, payload: EditEntitySubmitPayload): AlbumChanges => {
    const changes: AlbumChanges = {};
    const title = payload.primary.trim();
    if (title && title !== album.title) changes.title = title;
    const description = payload.secondary.trim();
    if (description) changes.description = description;
    if (payload.cover.coverBlob) changes.coverBlob = payload.cover.coverBlob;
    else if (payload.cover.removeCover) changes.removeCover = true;
    return changes;
  };

  return (
    album: AlbumEntity,
    currentCoverUrl: string | null | undefined,
    save: (changes: AlbumChanges) => Promise<void>,
  ) => summonDialog("editEntity", {
    title: t("dialogs.editAlbum.title"),
    coverAlt: "Album cover preview",
    currentCoverUrl,
    primaryField: {
      id: "album-title",
      label: t("dialogs.editAlbum.albumTitle"),
      placeholder: t("dialogs.editAlbum.titlePlaceholder"),
      maxLength: NAME_MAX_LENGTH,
      maxLengthMessage: t("dialogs.editAlbum.validation.titleMaxLength", { max: NAME_MAX_LENGTH }),
      requiredMessage: t("dialogs.editAlbum.validation.titleRequired"),
    },
    secondaryField: {
      id: "album-description",
      label: t("dialogs.editAlbum.description"),
      placeholder: t("dialogs.editAlbum.descriptionPlaceholder"),
      maxLength: ALBUM_DESCRIPTION_MAX_LENGTH,
      maxLengthMessage: t("dialogs.editAlbum.validation.descriptionMaxLength", { max: ALBUM_DESCRIPTION_MAX_LENGTH }),
    },
    initialPrimary: album.title,
    initialSecondary: "",
    coverErrorMessages: {
      invalidFormat: t("dialogs.editAlbum.errors.invalidFormat"),
      readError: t("dialogs.editAlbum.errors.readError"),
      unknown: t("dialogs.editAlbum.errors.unknown"),
    },
    save: payload => save(toChanges(album, payload)),
  }, { key: `edit:${album.id}` });
};
