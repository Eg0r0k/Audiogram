import { useQueryClient } from "@tanstack/vue-query";
import { useChangelogStore } from "../store/changelog.store";
import { onMounted } from "vue";
import { releaseNotesQueryOptions } from "../api/changelogApi";

export const useChangelogOnStartup = () => {
  const changelogStore = useChangelogStore();

  const queryClient = useQueryClient();

  onMounted(async () => {
    const isNewVersion = changelogStore.checkOnStartup();
    if (!isNewVersion) return;

    if (changelogStore.pendingChangelog) return;

    const tag = `v${__APP_VERSION__}`;

    try {
      const markdown = await queryClient.ensureQueryData(releaseNotesQueryOptions(tag));

      if (markdown) {
        changelogStore.setPendingChangelog(__APP_VERSION__, markdown);
      }
      else {
        changelogStore.markSeen();
      }
    }
    catch {
      changelogStore.markSeen();
    }
  });
};
