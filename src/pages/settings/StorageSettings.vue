<template>
  <SettingsScreen :title="$t('settings.index.storage')">
    <SettingsGroup>
      <Item>
        <ItemMedia>
          <div class="relative size-10 shrink-0 z-1">
            <svg
              class="size-10 -rotate-90"
              viewBox="0 0 36 36"
            >
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                class=" text-background"
              />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                class="text-primary transition-[stroke-dashoffset] duration-300"
                :stroke-dasharray="`${2 * Math.PI * 15}`"
                :stroke-dashoffset="`${2 * Math.PI * 15 * (1 - (formatted.usagePercent || 0) / 100)}`"
              />
            </svg>
            <span class="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
              {{ formatted.usagePercent || 0 }}%
            </span>
          </div>
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{{ $t('settings.storage.usage') }}</ItemTitle>
          <ItemSubtitle v-if="isLoading">
            {{ $t('common.loading') }}
          </ItemSubtitle>
          <ItemSubtitle v-else>
            {{ formatted.totalUsed }} {{ $t('settings.storage.used') }}
            <template v-if="formatted.quotaTotal">
              · {{ formatted.quotaFree }} {{ $t('settings.storage.free') }}
            </template>
          </ItemSubtitle>
        </ItemContent>
      </Item>
    </SettingsGroup>

    <SettingsGroup class="mt-3 mb-3">
      <div class="px-4 py-3">
        <div class="text-primary font-medium mb-1">
          {{ $t("settings.storage.sizeTitle") }}
        </div>
      </div>
      <Item>
        <ItemMedia>
          <MusicIcon class="size-6 mr-3" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{{ $t('settings.storage.database') }}</ItemTitle>
          <ItemSubtitle v-if="isLoading">
            {{ $t('common.loading') }}
          </ItemSubtitle>
          <ItemSubtitle v-else>
            {{ formatted.tracksCount }} {{ $t('settings.storage.tracksCount') }}
            · {{ formatted.albumsCount }} {{ $t('settings.storage.albumsCount') }}
            · {{ formatted.artistsCount }} {{ $t('settings.storage.artistsCount') }} ({{ formatted.dbSize }})
          </ItemSubtitle>
        </ItemContent>
      </Item>
      <Item>
        <ItemMedia>
          <MusicIcon class="size-6 mr-3" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{{ $t('settings.storage.tracks') }}</ItemTitle>
          <ItemSubtitle v-if="isLoading">
            {{ $t('common.loading') }}
          </ItemSubtitle>
          <ItemSubtitle v-else>
            <span class="text-sm text-muted-foreground">{{ formatted.tracksSize }}</span>
          </ItemSubtitle>
        </ItemContent>
        <ItemActions />
      </Item>

      <Item v-if="platformCaps.hasFs">
        <ItemMedia>
          <CloudDownIcon class="size-6 mr-3" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{{ $t('settings.storage.offline') }}</ItemTitle>
          <ItemSubtitle v-if="isLoading">
            {{ $t('common.loading') }}
          </ItemSubtitle>
          <ItemSubtitle v-else>
            <span class="text-sm text-muted-foreground">
              {{ formatted.offlineTotal }}
              · Navidrome {{ formatted.offlineNdSize }}
              · YouTube {{ formatted.offlineYtSize }}
            </span>
          </ItemSubtitle>
        </ItemContent>
        <ItemActions class="pointer-events-auto">
          <Button
            variant="ghost-primary"
            size="sm"
            :disabled="isLoading || isClearing || !formatted.hasOffline"
            @click="clearOfflineData"
          >
            {{ $t("settings.storage.clearOffline") }}
            <TrashIcon class="size-4" />
          </Button>
        </ItemActions>
      </Item>

      <!-- Live queue state next to the cache it fills (M4: visible batch
         progress). Renders nothing while no download is active. -->
      <ActiveDownloads v-if="platformCaps.hasFs" />

      <Item>
        <ItemMedia>
          <FileTextIcon class="size-6 mr-3" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{{ $t('settings.storage.lyrics') }}</ItemTitle>
          <ItemSubtitle v-if="isLoading">
            {{ $t('common.loading') }}
          </ItemSubtitle>
          <ItemSubtitle v-else>
            <span class="text-sm text-muted-foreground">{{ formatted.lyricsSize }}</span>
          </ItemSubtitle>
        </ItemContent>
        <ItemActions class="pointer-events-auto">
          <Button
            variant="ghost-primary"
            size="sm"
            :disabled="isLoading || isClearing"
            @click="clearLyricsData"
          >
            {{ $t("common.delete") }}
            <TrashIcon class="size-4" />
          </Button>
        </ItemActions>
      </Item>
      <Item>
        <ItemMedia>
          <FolderIcon class="size-6 mr-3" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{{ $t('settings.storage.folders') }}</ItemTitle>
          <ItemSubtitle>
            <span class="text-sm text-muted-foreground">{{ $t('settings.storage.foldersDesc') }}</span>
          </ItemSubtitle>
        </ItemContent>
        <ItemActions class="pointer-events-auto">
          <Button
            variant="ghost-primary"
            size="sm"
            :disabled="isLoading || isClearing"
            @click="clearFoldersData"
          >
            {{ $t("common.delete") }}
            <TrashIcon class="size-4" />
          </Button>
        </ItemActions>
      </Item>
      <Item>
        <ItemMedia>
          <ClockIcon class="size-6 mr-3" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{{ $t('settings.storage.timings') }}</ItemTitle>
          <ItemSubtitle>
            <span class="text-sm text-muted-foreground">{{ $t('settings.storage.timingsDesc') }}</span>
          </ItemSubtitle>
        </ItemContent>
        <ItemActions class="pointer-events-auto">
          <Button
            variant="ghost-primary"
            size="sm"
            :disabled="isLoading || isClearing"
            @click="handleClearTimings"
          >
            {{ $t("common.delete") }}
            <TrashIcon class="size-4" />
          </Button>
        </ItemActions>
      </Item>
      <Item v-copy="{ text: formatted.storagePath, onCopy: handleStoragePathCopied }">
        <ItemContent>
          <ItemTitle>{{ $t('settings.storage.location') }}</ItemTitle>
          <ItemSubtitle v-if="isLoading">
            {{ $t('common.loading') }}
          </ItemSubtitle>
          <ItemSubtitle
            v-else
            class="break-all"
          >
            {{ formatted.storagePath }}
          </ItemSubtitle>
        </ItemContent>
      </Item>
      <Button
        class="w-full h-14 justify-start  "
        variant="ghost-primary"
        size="xl"
        :disabled="isClearing"
        @click="handleClearAll"
      >
        <TrashIcon class=" size-6" />
        {{ $t('settings.storage.clearAll') }}
      </Button>
    </SettingsGroup>
    <WatchedFoldersSection
      v-if="platformCaps.hasFs"
    />
  </SettingsScreen>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import { summonDialog } from "@/components/dialogs/summonDialog";

import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemSubtitle,
  ItemTitle,
} from "@/components/ui/item";

import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import SettingsScreen from "@/modules/settings/components/SettingsScreen.vue";

import { useStorageSettings } from "@/modules/settings/store/storage";

import TrashIcon from "~icons/tabler/trash";
import CloudDownIcon from "~icons/tabler/cloud-down";
import FileTextIcon from "~icons/tabler/file-text";
import MusicIcon from "~icons/tabler/music";
import FolderIcon from "~icons/tabler/folder";
import ClockIcon from "~icons/tabler/clock";

import { Button } from "@/components/ui/button";
import { platformCaps } from "@/lib/environment/platformCaps";
import ActiveDownloads from "@/modules/downloads/components/ActiveDownloads.vue";
import WatchedFoldersSection from "@/modules/watched-folders/components/WatchedFoldersSection.vue";
import { getLogger } from "@/lib/logger";
import { markRecommenderContextDirty } from "@/modules/recommendations/service/recommender-context.service";
import { invalidateWeightsCache } from "@/modules/recommendations/service/recommender-model.service";

const {
  isLoading,
  isClearing,
  formatted,
  refresh,
  clearAllData,
  clearLyricsData,
  clearFoldersData,
  clearOfflineData,
  clearTimingsData,
} = useStorageSettings();

const { t } = useI18n();

// The wipe took the listen events, the audio features and the model row with
// it; both in-memory recommender caches would otherwise keep serving them.
// Wired here, not in the settings store: a core module must not import a
// feature module (ARCHITECTURE.md §3, M2).
const handleClearTimings = async () => {
  await clearTimingsData();
  markRecommenderContextDirty();
  invalidateWeightsCache();
};

const handleStoragePathCopied = () => {
  toast.success(t("settings.storage.locationCopied"));
};

async function handleClearAll() {
  const cleared = await summonDialog("clearAllData", {
    stats: {
      tracksCount: formatted.value.tracksCount,
      albumsCount: formatted.value.albumsCount,
      artistsCount: formatted.value.artistsCount,
      totalUsed: formatted.value.totalUsed,
    },
    clear: clearAllData,
  }, { key: "clear-all-data" });
  if (cleared) toast.success(t("settings.storage.allDataCleared"));
}

onMounted(() => {
  // The panel renders its own loading/error state; the log only records WHY a
  // storage-usage refresh never produced numbers.
  refresh().catch((err: unknown) => {
    getLogger().warn(`[StorageSettings] Refreshing storage usage failed: ${String(err)}`);
  });
});
</script>
