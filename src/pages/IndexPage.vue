<template>
  <div class="flex min-h-0 flex-1 flex-col bg-background">
    <LibrarySidebar
      v-if="isMobileLayout"
      class="h-full bg-card"
    />
  </div>
</template>
<script lang="ts" setup>
import LibrarySidebar from "@/components/layout/sidebar/LibrarySidebar.vue";
import { useDeviceLayout } from "@/composables/useDeviceLayout";

const { isMobileLayout } = useDeviceLayout();

</script>
