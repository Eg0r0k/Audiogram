<template>
  <Button
    v-if="!hasCopy"
    size="icon-sm"
    variant="ghost"
    class="shrink-0 rounded-full text-muted-foreground hover:text-foreground transition-opacity"
    :class="[
      activeJob ? '' : 'opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100',
    ]"
    :disabled="!!activeJob"
    :aria-label="label"
    :title="label"
    @click.stop="download"
  >
    <BlurSwapTransition :state="activeJob ? 'loading' : 'idle'">
      <Spinner
        v-if="activeJob"
        class="size-4.5"
      />
      <IconDownload
        v-else
        class="size-4.5"
      />
    </BlurSwapTransition>
  </Button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useQuery } from "@tanstack/vue-query";
import { Button } from "@/components/ui/button";
import BlurSwapTransition from "@/components/transitions/BlurSwapTransition.vue";
import type { SourceTrackDTO } from "@/modules/sources/types";
import { offlineCopyQueries } from "@/queries/offlineCopy.queries";
import { downloadDtoWithFeedback } from "../downloadFeedback";
import { useDownloadsStore } from "../store/downloads.store";
import { Spinner } from "@/components/ui/spinner";
import IconDownload from "~icons/tabler/download";

const props = defineProps<{
  /** Source DTO of the remote row. */
  dto: SourceTrackDTO;
}>();

const { t } = useI18n();
const downloadsStore = useDownloadsStore();

const activeJob = computed(() => downloadsStore.byTrackId[props.dto.id]);

const { data: offlineCopy } = useQuery(computed(() => offlineCopyQueries.detail(props.dto.id)));
const hasCopy = computed(() => !!offlineCopy.value);

const label = computed(() => {
  const job = activeJob.value;
  if (job) {
    return job.status === "running" && job.total
      ? `${Math.min(100, Math.round((job.downloaded / job.total) * 100))}%`
      : t("downloads.downloading");
  }
  return t("track.contextMenu.download");
});

async function download(): Promise<void> {
  if (activeJob.value || hasCopy.value) return;
  await downloadDtoWithFeedback(props.dto);
}
</script>
