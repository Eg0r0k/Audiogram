<template>
  <component
    :is="Item"
    v-if="canShowDetails(caps)"
    @click="emit('show')"
  >
    <IconInfoCircle class="size-5.5" />
    {{ $t("track.contextMenu.details") }}
  </component>
</template>

<script setup lang="ts">
import IconInfoCircle from "~icons/tabler/info-circle";
import { canShowDetails, type TrackMenuCaps } from "@/modules/tracks/composables/useTrackMenuCaps";
import { useTrackMenuComponents } from "../useTrackMenuComponents";

defineOptions({
  inheritAttrs: false,
});

defineProps<{
  /** Absent on library-only call sites, which always have their row. */
  caps?: TrackMenuCaps | null;
}>();

const { Item } = useTrackMenuComponents();

const emit = defineEmits<{
  show: [];
}>();
</script>
