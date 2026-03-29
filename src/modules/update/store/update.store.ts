import { listen } from "@tauri-apps/api/event";
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { useChangelogStore } from "./changelog.store";
import type { DownloadProgress, UpdateChannel, UpdateError, UpdateInfo, UpdateStatus } from "../types";
import { checkUpdate, installUpdate } from "../api/updateApi";

export const useUpdateStore = defineStore("update", () => {
  const status = ref<UpdateStatus>("idle");
  const updateInfo = ref<UpdateInfo | null>(null);
  const error = ref<UpdateError | null>(null);
  const channel = ref<UpdateChannel>("stable");
  const downloadProgress = ref<DownloadProgress | null>(null);

  const isUpdateAvailable = computed(() => status.value === "available");
  const isDownloading = computed(() => status.value === "downloading");
  const isInstalling = computed(() => status.value === "installing");
  const isBusy = computed(
    () =>
      status.value === "checking"
      || status.value === "downloading"
      || status.value === "installing",
  );
  const downloadPercent = computed(() => {
    const p = downloadProgress.value;
    if (!p || !p.contentLength) return null;
    return Math.round((p.chunkLength / p.contentLength) * 100);
  });

  const setChannel = (c: UpdateChannel) => {
    channel.value = c;
  };

  const check = async (): Promise<void> => {
    if (isBusy.value) return;

    status.value = "checking";
    error.value = null;
    downloadProgress.value = null;

    const result = await checkUpdate(channel.value);

    result.match(
      (info) => {
        if (info) {
          updateInfo.value = info;
          status.value = "available";
        }
        else {
          updateInfo.value = null;
          status.value = "up-to-date";
        }
      },
      (e) => {
        error.value = e;
        status.value = "error";
      },
    );
  };

  const install = async (): Promise<void> => {
    if (status.value !== "available") return;

    const changelogStore = useChangelogStore();

    status.value = "downloading";
    downloadProgress.value = { chunkLength: 0, contentLength: null };

    const unlistenProgress = await listen<DownloadProgress>(
      "update://download-progress",
      ({ payload }) => {
        if (status.value !== "downloading") return;
        downloadProgress.value = {
          chunkLength: (downloadProgress.value?.chunkLength ?? 0) + payload.chunkLength,
          contentLength: payload.contentLength,
        };
      },
    );

    const unlistenInstallStarted = await listen("update://install-started", () => {
      status.value = "installing";
      unlistenProgress();
    });

    const result = await installUpdate(channel.value);

    unlistenProgress();
    unlistenInstallStarted();

    result.match(
      () => {
        if (updateInfo.value) {
          changelogStore.setPendingChangelog(
            updateInfo.value.version,
            updateInfo.value.body ?? "",
          );
        }
      },
      (e) => {
        error.value = e;
        status.value = "error";
        downloadProgress.value = null;
      },
    );
  };

  const dismiss = (): void => {
    if (
      status.value === "available"
      || status.value === "up-to-date"
      || status.value === "error"
    ) {
      status.value = "idle";
      error.value = null;
    }
  };

  return {
    status,
    updateInfo,
    error,
    channel,
    downloadProgress,
    isUpdateAvailable,
    isDownloading,
    isInstalling,
    isBusy,
    downloadPercent,
    setChannel,
    check,
    install,
    dismiss,
  };
});
