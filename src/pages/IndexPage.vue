<template>
  <Scrollable class="flex-1">
    <LibrarySidebar
      v-if="isMobileLayout"
      class="h-full bg-card"
    />
    <div
      v-else
      class="relative flex  items-center justify-center  h-full overflow-hidden bg-background"
    >
      <IconLogo class=" text-muted-foreground" />
    </div>
  </Scrollable>
</template>
<script lang="ts" setup>
import LibrarySidebar from "@/components/layout/sidebar/LibrarySidebar.vue";
import Scrollable from "@/components/ui/scrollable/Scrollable.vue";
import { useDeviceLayout } from "@/composables/useDeviceLayout";
import IconLogo from "~icons/audiogram/logo";
const { isMobileLayout } = useDeviceLayout();

</script>
