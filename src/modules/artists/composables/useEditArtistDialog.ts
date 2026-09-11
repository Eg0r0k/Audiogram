import { useI18n } from "vue-i18n";
import { summonDialog } from "@/components/dialogs/summonDialog";
import type { EditEntitySubmitPayload } from "@/components/dialogs/editEntityDialog";
import type { ArtistEntity } from "@/db/entities";
import { ARTIST_BIO_MAX_LENGTH, NAME_MAX_LENGTH } from "@/lib/limits";
import type { ArtistChanges } from "@/queries/artist.queries";

/**
 * Opens the shared entity editor for one Artist. `save` receives only what
 * changed and runs inside the dialog, which closes on success and stays open
 * (with the input) on failure. Resolves `true` once saved, `undefined` when
 * dismissed.
 */
export const useEditArtistDialog = () => {
  const { t } = useI18n();

  const toChanges = (artist: ArtistEntity, payload: EditEntitySubmitPayload): ArtistChanges => {
    const changes: ArtistChanges = {};
    const name = payload.primary.trim();
    if (name && name !== artist.name) changes.name = name;
    const bio = payload.secondary.trim();
    if (bio !== (artist.bio ?? "")) changes.bio = bio;
    if (payload.cover.coverBlob) changes.coverBlob = payload.cover.coverBlob;
    else if (payload.cover.removeCover) changes.removeCover = true;
    return changes;
  };

  return (
    artist: ArtistEntity,
    currentCoverUrl: string | null | undefined,
    save: (changes: ArtistChanges) => Promise<void>,
  ) => summonDialog("editEntity", {
    title: t("dialogs.editArtist.title"),
    coverAlt: "Artist cover preview",
    currentCoverUrl,
    primaryField: {
      id: "artist-name",
      label: t("dialogs.editArtist.artistName"),
      placeholder: t("dialogs.editArtist.namePlaceholder"),
      maxLength: NAME_MAX_LENGTH,
      maxLengthMessage: t("dialogs.editArtist.validation.nameMaxLength", { max: NAME_MAX_LENGTH }),
      requiredMessage: t("dialogs.editArtist.validation.nameRequired"),
    },
    secondaryField: {
      id: "artist-bio",
      label: t("dialogs.editArtist.bio"),
      placeholder: t("dialogs.editArtist.bioPlaceholder"),
      maxLength: ARTIST_BIO_MAX_LENGTH,
      maxLengthMessage: t("dialogs.editArtist.validation.bioMaxLength", { max: ARTIST_BIO_MAX_LENGTH }),
    },
    initialPrimary: artist.name,
    initialSecondary: artist.bio ?? "",
    coverErrorMessages: {
      invalidFormat: t("dialogs.editArtist.errors.invalidFormat"),
      readError: t("dialogs.editArtist.errors.readError"),
      unknown: t("dialogs.editArtist.errors.unknown"),
    },
    save: payload => save(toChanges(artist, payload)),
  }, { key: `edit:${artist.id}` });
};
