<template>
  <!-- Any remote source served by the shared download manager (ND, YT — M5). -->
  <template v-if="caps && caps.source !== 'local'">
    <component
      :is="Item"
      v-if="activeJob"
      @click="emit('cancelDownload')"
    >
      <Spinner class="size-5.5" />
      {{ $t("track.contextMenu.cancelDownload") }}{{ progressSuffix }}
    </component>

    <component
      :is="Item"
      v-else-if="caps.hasLocalCopy"
      @click="emit('removeDownload')"
    >
      <IconCloudOff class="size-5.5" />
      {{ $t("track.contextMenu.removeDownload") }}
    </component>

    <component
      :is="Item"
      v-else-if="caps.canDownload"
      @click="emit('download')"
    >
      <IconDownload class="size-5.5" />
      {{ $t("track.contextMenu.download") }}
    </component>
  </template>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Spinner } from "@/components/ui/spinner";
import IconDownload from "~icons/tabler/download";
import IconCloudOff from "~icons/tabler/cloud-off";
import { useDownloadsStore } from "@/modules/downloads/store/downloads.store";
import type { TrackMenuCaps } from "@/modules/tracks/composables/useTrackMenuCaps";
import type { TrackId } from "@/types/ids";
import { useTrackMenuComponents } from "../useTrackMenuComponents";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<{
  /** Absent caps (shell not yet caps-aware) renders nothing — safe default. */
  caps?: TrackMenuCaps | null;
  trackId?: string | null;
}>();

const emit = defineEmits<{
  download: [];
  cancelDownload: [];
  removeDownload: [];
}>();

const { Item } = useTrackMenuComponents();
const downloadsStore = useDownloadsStore();

const activeJob = computed(() =>
  props.trackId ? downloadsStore.byTrackId[props.trackId as TrackId] : undefined,
);

const progressSuffix = computed(() => {
  const job = activeJob.value;
  if (!job || job.status !== "running" || !job.total) return "";
  return ` · ${Math.min(100, Math.round((job.downloaded / job.total) * 100))}%`;
});
</script>
