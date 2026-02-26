import { ref, computed } from "vue";
import { StorageInfo } from "../schema/storage";
import { clearAllData, clearCovers, collectStorageInfo } from "@/services/storage-info.service";
import { formatBytes } from "@/lib/format/memory";

export function useStorageSettings() {
  const info = ref<StorageInfo | null>(null);
  const isLoading = ref(false);
  const isClearing = ref(false);

  const totalUsedByApp = computed(() => {
    if (!info.value) return 0;
    return info.value.tracksSize + info.value.coversSize + info.value.dbSize;
  });

  const formatted = computed(() => {
    if (!info.value) {
      return {
        tracksSize: "—",
        coversSize: "—",
        dbSize: "—",
        totalUsed: "—",
        quotaTotal: "—",
        quotaUsed: "—",
        quotaFree: "—",
        tracksCount: 0,
        albumsCount: 0,
        artistsCount: 0,
        storagePath: "—",
        usagePercent: 0,
      };
    }

    const i = info.value;

    return {
      tracksSize: formatBytes(i.tracksSize),
      coversSize: formatBytes(i.coversSize),
      dbSize: formatBytes(i.dbSize),
      totalUsed: formatBytes(totalUsedByApp.value),
      quotaTotal: i.quotaTotal > 0 ? formatBytes(i.quotaTotal) : null,
      quotaUsed: i.quotaUsed > 0 ? formatBytes(i.quotaUsed) : null,
      quotaFree: i.quotaTotal > 0
        ? formatBytes(i.quotaTotal - i.quotaUsed)
        : null,
      tracksCount: i.tracksCount,
      albumsCount: i.albumsCount,
      artistsCount: i.artistsCount,
      storagePath: i.storagePath,
      usagePercent: i.quotaTotal > 0
        ? Math.round((i.quotaUsed / i.quotaTotal) * 100)
        : 0,
    };
  });

  async function refresh() {
    isLoading.value = true;
    try {
      info.value = await collectStorageInfo();
    }
    finally {
      isLoading.value = false;
    }
  }

  async function handleClearCovers() {
    isClearing.value = true;
    try {
      await clearCovers();
      await refresh();
    }
    finally {
      isClearing.value = false;
    }
  }

  async function handleClearAll() {
    isClearing.value = true;
    try {
      await clearAllData();
      await refresh();
    }
    finally {
      isClearing.value = false;
    }
  }

  return {
    info,
    isLoading,
    isClearing,
    formatted,
    refresh,
    clearCovers: handleClearCovers,
    clearAllData: handleClearAll,
  };
}
