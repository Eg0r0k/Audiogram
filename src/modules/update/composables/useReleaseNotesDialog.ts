import { useQueryClient } from "@tanstack/vue-query";
import { ref } from "vue";
import { releaseNotesQueryOptions } from "../api/changelogApi";
import { normalizeReleaseNotes } from "../lib/releaseNotes";
import { useChangelogStore } from "../store/changelog.store";

export const useReleaseNotesDialog = () => {
  const changelogStore = useChangelogStore();
  const queryClient = useQueryClient();

  const isOpening = ref(false);
  const error = ref<string | null>(null);

  const clearError = () => {
    error.value = null;
  };

  const openVersion = async (
    version: string,
    initialMarkdown?: string | null,
  ): Promise<boolean> => {
    clearError();

    if (
      version === changelogStore.pendingVersion
      && changelogStore.pendingChangelog
    ) {
      changelogStore.openPending();
      return true;
    }

    const inlineNotes = initialMarkdown?.trim();
    if (inlineNotes) {
      changelogStore.openPreview(version, normalizeReleaseNotes(inlineNotes));
      return true;
    }

    isOpening.value = true;

    try {
      const markdown = await queryClient.ensureQueryData(
        releaseNotesQueryOptions(`v${version}`),
      );
      changelogStore.openPreview(version, normalizeReleaseNotes(markdown));
      return true;
    }
    catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause);
      return false;
    }
    finally {
      isOpening.value = false;
    }
  };

  const openCurrent = () => openVersion(
    __APP_VERSION__,
    changelogStore.pendingVersion === __APP_VERSION__
      ? changelogStore.pendingChangelog
      : null,
  );

  return {
    isOpening,
    error,
    clearError,
    openCurrent,
    openVersion,
  };
};
