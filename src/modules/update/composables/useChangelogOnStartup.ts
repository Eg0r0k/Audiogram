import { useQueryClient } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import { onMounted, watch } from "vue";
import { toaster } from "@/app/toaster";
import { useChangelogStore } from "../store/changelog.store";
import { releaseNotesQueryOptions } from "../api/changelogApi";
import { normalizeReleaseNotes } from "../lib/releaseNotes";

const WHATS_NEW_TOAST_ID = "whats-new";

export const useChangelogOnStartup = () => {
  const changelogStore = useChangelogStore();
  const { t } = useI18n();

  const queryClient = useQueryClient();

  // The news is offered, not opened over the app: a toast with the notes
  // behind its action. Closing the toast unread counts as seen; read notes
  // are marked seen when their dialog closes, which may be after the toast.
  watch(
    () => changelogStore.hasUnseenUpdate,
    (hasUnseenUpdate) => {
      if (!hasUnseenUpdate) {
        toaster.remove(WHATS_NEW_TOAST_ID);
        return;
      }
      toaster.add({
        id: WHATS_NEW_TOAST_ID,
        title: t("update.updatedTo", { version: changelogStore.pendingVersion ?? __APP_VERSION__ }),
        color: "info",
        actions: [{
          label: t("update.whatsNewTitle"),
          onClick: () => changelogStore.openPending(),
        }],
        onClose: () => {
          if (!changelogStore.isDialogOpen) changelogStore.markSeen();
        },
      });
    },
    { immediate: true },
  );

  onMounted(async () => {
    const isNewVersion = changelogStore.checkOnStartup();
    if (!isNewVersion) return;

    if (
      changelogStore.pendingVersion === __APP_VERSION__
      && changelogStore.pendingChangelog
    ) {
      return;
    }

    const tag = `v${__APP_VERSION__}`;

    try {
      const markdown = await queryClient.ensureQueryData(releaseNotesQueryOptions(tag));
      changelogStore.setPendingChangelog(
        __APP_VERSION__,
        normalizeReleaseNotes(markdown),
      );
    }
    catch {
    // noop
    }
  });
};
