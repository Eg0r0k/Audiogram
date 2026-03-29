import { useStorage } from "@vueuse/core";
import { defineStore } from "pinia";
import { computed, ref } from "vue";

export const useChangelogStore = defineStore("changelog", () => {
  const lastSeenVersion = useStorage<string>("audiogram:lastSeenVersion", "");

  const pendingChangelog = ref<string | null>(null);
  const pendingVersion = ref<string | null>(null);

  const hasUnseenUpdate = computed(
    () =>
      pendingChangelog.value !== null
      && pendingVersion.value !== null
      && pendingVersion.value !== lastSeenVersion.value,
  );

  const setPendingChangelog = (version: string, changelog: string) => {
    pendingVersion.value = version;
    pendingChangelog.value = changelog;
  };

  const markSeen = () => {
    lastSeenVersion.value = __APP_VERSION__;
    pendingChangelog.value = null;
    pendingVersion.value = null;
  };

  const checkOnStartup = (): boolean => {
    if (lastSeenVersion.value === __APP_VERSION__) return false;
    // Version is new but we may not have changelog text yet (e.g. first install).
    // The caller is responsible for fetching it and calling setPendingChangelog.
    return true;
  };

  return {
    lastSeenVersion,
    pendingChangelog,
    pendingVersion,
    hasUnseenUpdate,
    setPendingChangelog,
    markSeen,
    checkOnStartup,
  };
});
