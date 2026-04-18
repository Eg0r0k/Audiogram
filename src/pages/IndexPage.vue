<script setup lang="ts">
import LibrarySidebar from "@/components/layout/sidebar/LibrarySidebar.vue";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import Scrollable from "@/components/ui/scrollable/Scrollable.vue";
import { useDeviceLayout } from "@/composables/useDeviceLayout";
import IconLogo from "~icons/audiogram/logo";
import IconPlus from "~icons/tabler/plus";

const { isMobileLayout } = useDeviceLayout();

</script>

<template>
  <Scrollable
    direction="vertical"
    class="flex-1 "
  >
    <LibrarySidebar
      v-if="isMobileLayout"
      class="bg-card h-full"
    />
    <div
      v-else
      class="h-full"
    />
    <!-- <Empty class="h-full gap-4">
      <EmptyHeader>
        <IconLogo class="size-40 text-white" />
        <EmptyTitle class="text-xl font-bold">
          Start your journey
        </EmptyTitle>
        <EmptyDescription class=" text-lg">
          Create a hove for your work-in-progress <br> music
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div class="flex gap-2">
          <Button
            size="xl"
            class=" rounded-full gap-2"
          >
            <IconPlus class="size-6" />
            Add audio
          </Button>
        </div>
      </EmptyContent>
    </Empty> -->
  </Scrollable>
</template>
