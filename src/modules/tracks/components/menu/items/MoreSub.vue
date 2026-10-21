<template>
  <component
    :is="Sub"
    v-if="hasItems"
  >
    <component :is="SubTrigger">
      <IconDots class="size-5.5" />
      {{ $t("track.contextMenu.more") }}
    </component>

    <component
      :is="SubContent"
      class="w-56"
    >
      <SourceItems
        :caps="caps"
        @add-to-library="emit('addToLibrary')"
        @remove-from-library="emit('removeFromLibrary')"
        @open-external="emit('openExternal')"
      />

      <ExportFileItem
        :caps="caps"
        @export="emit('export')"
      />

      <LyricsItem
        :has-lyrics="hasLyrics"
        @attach="emit('attachLyrics')"
      />
    </component>
  </component>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { injectResponsiveMenu } from "@/components/ui/responsive-menu";
import IconDots from "~icons/tabler/dots";
import ExportFileItem from "./ExportFileItem.vue";
import LyricsItem from "./LyricsItem.vue";
import SourceItems from "./SourceItems.vue";
import { useTrackMenuComponents } from "../useTrackMenuComponents";
import type { TrackMenuCaps } from "@/modules/tracks/composables/useTrackMenuCaps";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<{
  caps?: TrackMenuCaps | null;
  hasLyrics: boolean;
}>();

const { Sub, SubTrigger, SubContent } = useTrackMenuComponents();

const responsiveMenu = injectResponsiveMenu();

// In the sheet lyrics and a local track's "Save as" moved to the header,
// leaving a local track nothing to show here.
const hasItems = computed(() => responsiveMenu?.mode.value !== "sheet" || (props.caps?.source ?? "local") !== "local");

const emit = defineEmits<{
  export: [];
  attachLyrics: [];
  addToLibrary: [];
  removeFromLibrary: [];
  openExternal: [];
}>();
</script>
