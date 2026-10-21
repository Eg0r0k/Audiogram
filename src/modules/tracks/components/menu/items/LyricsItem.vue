<template>
  <component
    :is="Item"
    v-if="!inSheet"
    @click="emit('attach')"
  >
    <IconFileMusic class="size-5.5" />
    {{ hasLyrics ? $t("track.contextMenu.replaceLyrics") : $t("track.contextMenu.addLyrics") }}
  </component>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { injectResponsiveMenu } from "@/components/ui/responsive-menu";
import IconFileMusic from "~icons/tabler/file-music";
import { useTrackMenuComponents } from "../useTrackMenuComponents";

defineProps<{
  hasLyrics: boolean;
}>();

const { Item } = useTrackMenuComponents();
const responsiveMenu = injectResponsiveMenu();
// The sheet header shows this as a button.
const inSheet = computed(() => responsiveMenu?.mode.value === "sheet");

const emit = defineEmits<{
  attach: [];
}>();
</script>
