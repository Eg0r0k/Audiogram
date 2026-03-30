export const EMPTY_RELEASE_NOTES_MESSAGE
  = "Release notes have not been published for this version yet.";

export const normalizeReleaseNotes = (markdown: string | null | undefined): string => {
  const trimmed = markdown?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : EMPTY_RELEASE_NOTES_MESSAGE;
};
