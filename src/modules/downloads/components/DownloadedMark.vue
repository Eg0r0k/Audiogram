<template>
  <IconCheck
    v-if="isDownloaded"
    class="mr-1 size-4 shrink-0 text-foreground"
    :aria-label="$t('downloads.done')"
    :title="$t('downloads.done')"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { localCopyQueries } from "@/queries/localCopy.queries";
import type { TrackId } from "@/types/ids";
import IconCheck from "~icons/tabler/check";

const props = defineProps<{
  trackId: TrackId;
}>();

const { data: localCopy } = useQuery(computed(() => localCopyQueries.byRemoteId(props.trackId)));
const isDownloaded = computed(() => !!localCopy.value);
</script>
