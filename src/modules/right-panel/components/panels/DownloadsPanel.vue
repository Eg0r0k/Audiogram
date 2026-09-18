<template>
  <div class="flex h-full min-h-0 flex-col bg-card">
    <RightPanelHeader
      :show-close="true"
      :title="t('downloads.queueTitle')"
      @close="rightPanel.close()"
    />

    <Scrollable class="min-h-0 flex-1">
      <Empty
        v-if="jobs.length === 0"
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
            variant="outline"
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
            <ItemSubtitle class="text-xs">
              <template v-if="job.cancelling">
                {{ t("downloads.cancelling") }}
              </template>
              <template v-else-if="job.status === 'running'">
                {{ formatDownloadProgress(job.downloaded, job.total) ?? t("downloads.downloading") }}
              </template>
              <template v-else>
                {{ t("downloads.queued") }}
              </template>
            </ItemSubtitle>
          </ItemContent>

          <ItemActions class="pointer-events-auto">
            <Button
              variant="ghost"
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
import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemSubtitle, ItemTitle } from "@/components/ui/item";
import { useQuery } from "@tanstack/vue-query";
import { Button } from "@/components/ui/button";
import { Scrollable } from "@/components/ui/scrollable";
import RightPanelHeader from "@/modules/right-panel/components/RightPanelHeader.vue";
import { useRightPanelStore } from "@/modules/right-panel/store/right-panel.store";
import { useDownloadsStore } from "@/modules/downloads/store/downloads.store";
import { cancelTrackDownload } from "@/modules/downloads/service/manager";
import { formatDownloadProgress } from "@/modules/downloads/lib/formatDownloadProgress";
import { trackQueries } from "@/queries/track.queries";
import type { TrackId } from "@/types/ids";
import { Spinner } from "@/components/ui/spinner";
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

const trackIds = computed(() => jobs.value.map(job => job.trackId));

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
