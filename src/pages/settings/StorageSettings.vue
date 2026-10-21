<template>
  <SettingsScreen :title="$t('settings.index.storage')">
    <SettingsGroup>
      <div class="px-4 py-3">
        <div class="flex flex-wrap items-baseline gap-x-2">
          <span class="text-3xl font-bold tabular-nums">
            {{ info ? formatted.totalUsed : "—" }}
          </span>
          <span class="text-sm text-muted-foreground">{{ $t('settings.storage.usedByApp') }}</span>
        </div>

        <div
          class="mt-3 flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
          role="img"
          :aria-label="legendLabel"
        >
          <div
            v-for="segment in visibleSegments"
            :key="segment.key"
            class="h-full first:rounded-s-full last:rounded-e-full"
            :class="segment.color"
            :style="{ width: `${segment.percent}%` }"
          />
        </div>

        <ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <li
            v-for="segment in segments"
            :key="segment.key"
            class="flex items-center gap-1.5"
          >
            <span
              class="size-2 shrink-0 rounded-full"
              :class="segment.color"
              aria-hidden="true"
            />
            {{ segment.label }} · {{ segment.size }}
          </li>
        </ul>

        <div
          v-if="usageFailed"
          class="mt-3 flex flex-wrap items-center gap-x-2"
        >
          <p
            role="alert"
            class="text-sm text-destructive"
          >
            {{ $t('settings.storage.usageFailed') }}
          </p>
          <Button
            variant="ghost"
            color="muted"
            size="sm"
            @click="loadUsage"
          >
            {{ $t('common.retry') }}
          </Button>
        </div>
      </div>
    </SettingsGroup>

    <SettingsGroup class="mt-3">
      <div class="px-4 py-3">
        <div class="text-primary font-medium">
          {{ $t('settings.storage.whatTakesSpace') }}
        </div>
      </div>

      <Item>
        <ItemMedia>
          <MusicIcon class="size-6 mr-3" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{{ $t('settings.storage.tracks') }}</ItemTitle>
          <ItemDescription>{{ isLoading && !info ? $t('common.loading') : formatted.tracksSize }}</ItemDescription>
        </ItemContent>
      </Item>

      <Item>
        <ItemMedia>
          <DatabaseIcon class="size-6 mr-3" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{{ $t('settings.storage.database') }}</ItemTitle>
          <ItemDescription v-if="isLoading && !info">
            {{ $t('common.loading') }}
          </ItemDescription>
          <ItemDescription v-else>
            {{ formatted.tracksCount }} {{ $t('settings.storage.tracksCount') }}
            · {{ formatted.albumsCount }} {{ $t('settings.storage.albumsCount') }}
            · {{ formatted.artistsCount }} {{ $t('settings.storage.artistsCount') }} ({{ formatted.dbSize }})
          </ItemDescription>
        </ItemContent>
      </Item>

      <Item>
        <ItemMedia>
          <ClockIcon class="size-6 mr-3" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{{ $t('settings.storage.timings') }}</ItemTitle>
          <ItemDescription>{{ $t('settings.storage.listens', formatted.listensCount) }}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button
            variant="ghost"
            color="destructive"
            size="icon-lg"
            class="rounded-full icon-size-6"
            :aria-label="$t('settings.storage.timingsDesc')"
            :title="$t('settings.storage.timingsDesc')"
            :disabled="isLoading || isClearing"
            @click="handleClearTimings"
          >
            <TrashIcon />
          </Button>
        </ItemActions>
      </Item>

      <Item>
        <ItemMedia>
          <FileTextIcon class="size-6 mr-3" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{{ $t('settings.storage.lyrics') }}</ItemTitle>
          <ItemDescription>{{ isLoading && !info ? $t('common.loading') : formatted.lyricsSize }}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button
            variant="ghost"
            color="destructive"
            size="icon-lg"
            class="rounded-full icon-size-6"
            :aria-label="$t('settings.storage.clearLyrics')"
            :title="$t('settings.storage.clearLyrics')"
            :disabled="isLoading || isClearing"
            @click="handleClearLyrics"
          >
            <TrashIcon />
          </Button>
        </ItemActions>
      </Item>
    </SettingsGroup>

    <SettingsGroup class="mt-3">
      <Item v-copy="{ text: formatted.storagePath, onCopy: handleStoragePathCopied, onError: handleStoragePathCopyFailed }">
        <ItemContent>
          <ItemTitle>{{ $t('settings.storage.location') }}</ItemTitle>
          <ItemDescription
            v-if="isLoading && !info"
          >
            {{ $t('common.loading') }}
          </ItemDescription>
          <ItemDescription
            v-else
            class="break-all"
          >
            {{ formatted.storagePath }}
          </ItemDescription>
        </ItemContent>
      </Item>
    </SettingsGroup>

    <SettingsGroup class="mt-3">
      <Item
        v-ripple
        as-child
        size="sm"
        class="cursor-pointer"
      >
        <button
          type="button"
          class="w-full text-left disabled:pointer-events-none disabled:opacity-50"
          :disabled="isClearing"
          @click="handleClearAll"
        >
          <ItemMedia>
            <TrashIcon class="size-6 mr-3 text-destructive" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle class="text-destructive">
              {{ $t('settings.storage.clearAll') }}
            </ItemTitle>
            <ItemDescription>{{ $t('settings.storage.clearAllDesc') }}</ItemDescription>
          </ItemContent>
        </button>
      </Item>
    </SettingsGroup>
  </SettingsScreen>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { reportError } from "@/app/error-feedback";
import { toaster } from "@/app/toaster";
import { summonDialog } from "@/components/dialogs/summonDialog";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import SettingsScreen from "@/modules/settings/components/SettingsScreen.vue";
import { useStorageSettings } from "@/modules/settings/store/storage";
import TrashIcon from "~icons/tabler/trash";
import FileTextIcon from "~icons/tabler/file-text";
import MusicIcon from "~icons/tabler/music";
import DatabaseIcon from "~icons/tabler/database";
import ClockIcon from "~icons/tabler/clock";
import { formatBytes } from "@/lib/format/memory";
import { formatError } from "@/lib/errors";
import { getLogger } from "@/lib/logger";
import { markRecommenderContextDirty } from "@/modules/recommendations/service/recommender-context.service";
import { invalidateWeightsCache } from "@/modules/recommendations/service/recommender-model.service";

const {
  info,
  isLoading,
  isClearing,
  formatted,
  refresh,
  clearAllData,
  clearLyricsData,
  clearTimingsData,
} = useStorageSettings();

const { t } = useI18n();

const usageFailed = ref(false);

// Listening history lives in the database file, so it has no slice of its own.
const segments = computed(() => {
  const sizes = [
    { key: "tracks", label: t("settings.storage.tracks"), bytes: info.value?.tracksSize ?? 0, color: "bg-primary" },
    { key: "database", label: t("settings.storage.database"), bytes: info.value?.dbSize ?? 0, color: "bg-chart-2" },
    { key: "lyrics", label: t("settings.storage.lyrics"), bytes: info.value?.lyricsSize ?? 0, color: "bg-chart-3" },
  ];
  const total = sizes.reduce((sum, segment) => sum + segment.bytes, 0);
  return sizes.map(segment => ({
    ...segment,
    size: info.value ? formatBytes(segment.bytes) : "—",
    percent: total > 0 ? (segment.bytes / total) * 100 : 0,
  }));
});

const visibleSegments = computed(() => segments.value.filter(segment => segment.percent > 0));

const legendLabel = computed(() => segments.value.map(segment => `${segment.label}: ${segment.size}`).join(", "));

interface WipeTexts {
  title: string;
  description: string;
  confirmLabel: string;
  failedText: string;
  doneText: string;
}

const confirmWipe = async (what: string, { doneText, ...texts }: WipeTexts, run: () => Promise<void>) => {
  const done = await summonDialog("confirmWipe", {
    ...texts,
    run: async () => {
      try {
        await run();
      }
      catch (error) {
        getLogger().error(`[StorageSettings] ${what} failed: ${formatError(error)}`);
        throw error;
      }
    },
  }, { key: what });
  if (done) toaster.add({ title: doneText, color: "success" });
};

// The wipe took the listen events, the audio features and the model row with
// it; both in-memory recommender caches would otherwise keep serving them.
// Wired here, not in the settings store: a core module must not import a
// feature module (ARCHITECTURE.md §3, M2).
const handleClearTimings = () => confirmWipe("clear-timings", {
  title: t("settings.storage.timingsDialogTitle"),
  description: t("settings.storage.timingsDialogDesc"),
  confirmLabel: t("settings.storage.timingsConfirm"),
  failedText: t("settings.storage.timingsClearFailed"),
  doneText: t("settings.storage.timingsCleared"),
}, async () => {
  await clearTimingsData();
  markRecommenderContextDirty();
  invalidateWeightsCache();
});

const handleClearLyrics = () => confirmWipe("clear-lyrics", {
  title: t("settings.storage.lyricsDialogTitle"),
  description: t("settings.storage.lyricsDialogDesc"),
  confirmLabel: t("settings.storage.clearLyrics"),
  failedText: t("settings.storage.lyricsClearFailed"),
  doneText: t("settings.storage.lyricsCleared"),
}, clearLyricsData);

const handleClearAll = () => confirmWipe("clear-all-data", {
  title: t("settings.storage.clearAllDialogTitle"),
  description: t("settings.storage.clearAllDialogDesc"),
  confirmLabel: t("settings.storage.clearAllConfirm"),
  failedText: t("settings.storage.clearAllFailed"),
  doneText: t("settings.storage.allDataCleared"),
}, clearAllData);

const handleStoragePathCopied = () => {
  toaster.add({ title: t("settings.storage.locationCopied"), color: "success" });
};

const handleStoragePathCopyFailed = (error: unknown) => {
  reportError(error, { title: t("common.copyFailed"), scope: "Storage" });
};

const loadUsage = () => {
  usageFailed.value = false;
  refresh().catch((err: unknown) => {
    usageFailed.value = true;
    getLogger().warn(`[StorageSettings] Refreshing storage usage failed: ${formatError(err)}`);
  });
};

onMounted(loadUsage);
</script>
