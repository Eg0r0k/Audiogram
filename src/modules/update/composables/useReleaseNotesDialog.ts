import { useQuery } from "@tanstack/vue-query";
import { computed } from "vue";
import { GITHUB_RELEASES_URL, releasePageUrl, releaseQueryOptions } from "../api/changelogApi";
import { useChangelogStore } from "../store/changelog.store";

export type ReleaseNotesStatus = "loading" | "ready" | "empty" | "error";

export const useReleaseNotesDialog = () => {
  const changelogStore = useChangelogStore();

  const version = computed(() => changelogStore.activeVersion);
  const tag = computed(() => `v${version.value}`);

  const query = useQuery(computed(() => ({
    ...releaseQueryOptions(tag.value),
    enabled: changelogStore.isDialogOpen,
  })));

  const release = computed(() => query.data.value);
  const storedBody = computed(() => changelogStore.activeChangelog);

  const body = computed(() => release.value?.body ?? storedBody.value ?? "");

  const status = computed<ReleaseNotesStatus>(() => {
    if (release.value !== undefined || storedBody.value !== null) {
      return body.value ? "ready" : "empty";
    }
    return query.isError.value || query.isPaused.value ? "error" : "loading";
  });

  const publishedAt = computed(() => {
    const iso = release.value?.publishedAt;
    return iso ? new Date(iso) : null;
  });

  const releaseUrl = computed(() => release.value?.url ?? releasePageUrl(tag.value));

  const retry = async () => {
    await query.refetch();
  };

  return {
    version,
    status,
    body,
    publishedAt,
    releaseUrl,
    releasesUrl: GITHUB_RELEASES_URL,
    retry,
  };
};
