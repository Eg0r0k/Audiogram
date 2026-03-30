import { useStorage } from "@vueuse/core";
import { defineStore } from "pinia";
import { computed, ref } from "vue";

export const useChangelogStore = defineStore("changelog", () => {
  const lastSeenVersion = useStorage<string>("audiogram:lastSeenVersion", "");
  const pendingChangelog = useStorage<string | null>(
    "audiogram:pendingChangelog",
    null,
  );
  const pendingVersion = useStorage<string | null>("audiogram:pendingVersion", null);
  const stagedChangelog = useStorage<string | null>(
    "audiogram:stagedChangelog",
    null,
  );
  const stagedVersion = useStorage<string | null>("audiogram:stagedVersion", null);

  const isDialogOpen = ref(false);
  const previewVersion = ref<string | null>(null);
  const previewChangelog = ref<string | null>(null);

  const activeVersion = computed(
    () => previewVersion.value ?? pendingVersion.value ?? __APP_VERSION__,
  );
  const activeChangelog = computed(
    () => previewChangelog.value ?? pendingChangelog.value,
  );

  const hasUnseenUpdate = computed(
    () =>
      pendingChangelog.value !== null
      && pendingVersion.value !== null
      && pendingVersion.value === __APP_VERSION__
      && pendingVersion.value !== lastSeenVersion.value,
  );

  const clearPendingChangelog = (version?: string) => {
    if (version && pendingVersion.value !== version) return;

    pendingVersion.value = null;
    pendingChangelog.value = null;
  };

  const clearStagedChangelog = (version?: string) => {
    if (version && stagedVersion.value !== version) return;

    stagedVersion.value = null;
    stagedChangelog.value = null;
  };

  const setPendingChangelog = (version: string, changelog: string) => {
    pendingVersion.value = version;
    pendingChangelog.value = changelog;
    clearStagedChangelog(version);
  };

  const stageChangelog = (version: string, changelog: string) => {
    stagedVersion.value = version;
    stagedChangelog.value = changelog;
  };

  const promoteStagedChangelog = (): boolean => {
    if (stagedVersion.value !== __APP_VERSION__ || !stagedChangelog.value) {
      return false;
    }

    setPendingChangelog(stagedVersion.value, stagedChangelog.value);
    clearStagedChangelog(stagedVersion.value);
    return true;
  };

  const openPending = () => {
    if (!pendingVersion.value || !pendingChangelog.value) return;

    previewVersion.value = null;
    previewChangelog.value = null;
    isDialogOpen.value = true;
  };

  const openPreview = (version: string, changelog: string) => {
    previewVersion.value = version;
    previewChangelog.value = changelog;
    isDialogOpen.value = true;
  };

  const closeDialog = () => {
    isDialogOpen.value = false;
    previewVersion.value = null;
    previewChangelog.value = null;

    if (hasUnseenUpdate.value) {
      markSeen();
    }
  };

  const markSeen = () => {
    lastSeenVersion.value = pendingVersion.value ?? __APP_VERSION__;
    clearPendingChangelog();
    previewVersion.value = null;
    previewChangelog.value = null;
    isDialogOpen.value = false;

    if (stagedVersion.value === __APP_VERSION__) {
      clearStagedChangelog(stagedVersion.value);
    }
  };

  const resetSeenState = () => {
    lastSeenVersion.value = "";
  };

  const checkOnStartup = (): boolean => {
    promoteStagedChangelog();

    if (pendingVersion.value && pendingVersion.value !== __APP_VERSION__) {
      clearPendingChangelog();
    }

    if (stagedVersion.value && stagedVersion.value !== __APP_VERSION__) {
      clearStagedChangelog();
    }

    return lastSeenVersion.value !== __APP_VERSION__;
  };

  return {
    lastSeenVersion,
    pendingChangelog,
    pendingVersion,
    stagedChangelog,
    stagedVersion,
    isDialogOpen,
    activeVersion,
    activeChangelog,
    hasUnseenUpdate,
    clearPendingChangelog,
    clearStagedChangelog,
    setPendingChangelog,
    stageChangelog,
    openPending,
    openPreview,
    closeDialog,
    markSeen,
    resetSeenState,
    checkOnStartup,
  };
});
