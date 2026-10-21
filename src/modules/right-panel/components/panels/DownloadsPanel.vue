<template>
  <div class="flex h-full min-h-0 flex-col bg-card">
    <RightPanelHeader
      :show-close="true"
      :title="t('downloads.queueTitle')"
      @close="rightPanel.close()"
    />

    <Scrollable class="min-h-0 flex-1">
      <Empty
        v-if="jobs.length === 0 && failedJobs.length === 0"
        class=" h-full"
      >
        <EmptyHeader>
          <EmptyMedia>
            <IconCloudDownload
              class="size-11 text-muted-foreground"
            />
          </EmptyMedia>
          <EmptyTitle>{{ t("downloads.empty") }}</EmptyTitle>
          <EmptyDescription>{{ t("downloads.emptySub") }}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            variant="solid"
            color="surface"
            @click="findMusic"
          >
            <IconSearch />
            {{ t("downloads.emptyAction") }}
          </Button>
        </EmptyContent>
      </Empty>

      <ItemGroup
        v-else
        class="gap-1 px-3 pb-4"
      >
        <Item
          v-for="entry in failedJobs"
          :key="entry.jobId"
          class="gap-3 rounded-lg px-2 py-2"
        >
          <ItemMedia>
            <IconAlertCircle class="size-5 text-destructive" />
          </ItemMedia>

          <ItemContent class="min-w-0">
            <ItemTitle class="w-full text-sm font-normal">
              <span class="min-w-0 truncate">{{ titleOf(entry.trackId) }}</span>
            </ItemTitle>
            <ItemDescription class="text-xs text-destructive">
              {{ t("downloads.failed") }}
            </ItemDescription>
          </ItemContent>

          <ItemActions class="pointer-events-auto">
            <Button
              variant="ghost"
              color="muted"
              size="sm"
              @click="retry(entry)"
            >
              {{ t("common.retry") }}
            </Button>
            <Button
              variant="ghost"
              color="muted"
              size="icon-sm"
              class="shrink-0 rounded-full text-muted-foreground hover:text-foreground"
              :aria-label="t('downloads.dismiss')"
              @click="dismiss(entry)"
            >
              <IconX class="size-4.5" />
            </Button>
          </ItemActions>
        </Item>

        <Item
          v-for="job in jobs"
          :key="job.jobId"
          class="gap-3 rounded-lg px-2 py-2"
        >
          <ItemMedia>
            <Spinner
              v-if="job.status === 'running'"
              class="size-5 text-primary"
            />
            <IconClock
              v-else
              class="size-5 text-muted-foreground"
            />
          </ItemMedia>

          <ItemContent class="min-w-0">
            <ItemTitle class="w-full text-sm font-normal">
              <span class="min-w-0 truncate">{{ titleOf(job.trackId) }}</span>
            </ItemTitle>
            <ItemDescription class="text-xs">
              <template v-if="job.cancelling">
                {{ t("downloads.cancelling") }}
              </template>
              <template v-else-if="job.status === 'running'">
                {{ formatDownloadProgress(job.downloaded, job.total) ?? t("downloads.downloading") }}
              </template>
              <template v-else>
                {{ t("downloads.queued") }}
              </template>
            </ItemDescription>
          </ItemContent>

          <ItemActions class="pointer-events-auto">
            <Button
              variant="ghost"
              color="muted"
              size="icon-sm"
              class="shrink-0 rounded-full text-muted-foreground hover:text-foreground"
              :disabled="job.cancelling"
              :aria-label="t('common.cancel')"
              @click="cancelTrackDownload(job.jobId)"
            >
              <IconX class="size-4.5" />
            </Button>
          </ItemActions>
        </Item>
      </ItemGroup>
    </Scrollable>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemDescription, ItemTitle } from "@/components/ui/item";
import { useQuery } from "@tanstack/vue-query";
import { Button } from "@/components/ui/button";
import { Scrollable } from "@/components/ui/scrollable";
import RightPanelHeader from "@/modules/right-panel/components/RightPanelHeader.vue";
import { useRightPanelStore } from "@/modules/right-panel/store/right-panel.store";
import { type FailedDownload, useDownloadsStore } from "@/modules/downloads/store/downloads.store";
import { cancelTrackDownload, dismissFailedDownload, enqueueTrackDownload } from "@/modules/downloads/service/manager";
import { toaster } from "@/app/toaster";
import { getLogger } from "@/lib/logger";
import { formatDownloadProgress } from "@/modules/downloads/lib/formatDownloadProgress";
import { trackQueries } from "@/queries/track.queries";
import type { TrackId } from "@/types/ids";
import { Spinner } from "@/components/ui/spinner";
import IconAlertCircle from "~icons/tabler/alert-circle";
import IconClock from "~icons/tabler/clock";
import IconCloudDownload from "~icons/tabler/cloud-download";
import IconSearch from "~icons/tabler/search";

import IconX from "~icons/tabler/x";
import EmptyTitle from "@/components/ui/empty/EmptyTitle.vue";
import { useSearch } from "@/modules/search/composables/useSearch";

const { t } = useI18n();
const rightPanel = useRightPanelStore();
const downloads = useDownloadsStore();
const { openSearch, requestSearchFocus } = useSearch();

const findMusic = (): void => {
  rightPanel.close();
  openSearch();
  requestSearchFocus();
};

const jobs = computed(() => Object.values(downloads.jobs));
const failedJobs = computed(() => Object.values(downloads.failed));

const trackIds = computed(() => [...failedJobs.value, ...jobs.value].map(job => job.trackId));

const retry = (entry: FailedDownload) => {
  enqueueTrackDownload(entry.trackId).catch((error: unknown) => {
    getLogger().error(`[Downloads] Retrying ${entry.trackId} failed: ${String(error)}`);
    toaster.add({ title: t("downloads.failed"), color: "destructive" });
  });
};

const dismiss = (entry: FailedDownload) => {
  dismissFailedDownload(entry.jobId)
    .catch((error: unknown) => getLogger().error(`[Downloads] Dismissing ${entry.jobId} failed: ${String(error)}`));
};

const { data: titleRows } = useQuery(computed(() => trackQueries.byIds(trackIds.value)));

const titles = computed(() => {
  const map = new Map<TrackId, string>();
  for (const row of titleRows.value ?? []) map.set(row.id, row.title);
  return map;
});

function titleOf(trackId: TrackId): string {
  return titles.value.get(trackId) ?? trackId;
}
</script>
