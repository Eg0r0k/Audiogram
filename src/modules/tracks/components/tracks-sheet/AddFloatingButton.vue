<template>
  <FloatingActionButton :show="show">
    <Button class="relative size-12 rounded-full shadow-lg">
      <span
        v-if="count > 0"
        class="absolute -right-1 -top-1 flex items-center justify-center rounded-full bg-secondary px-[7px] min-w-5 h-5 py-0.5 text-[14px] font-medium leading-none text-secondary-foreground"
      >
        {{ formatCountWithCap(count) }}
      </span>
      <IconPlusTrack class="size-6" />
    </Button>
  </FloatingActionButton>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";

import IconPlusTrack from "~icons/tabler/music-plus";
import { formatCountWithCap } from "@/lib/math";
import FloatingActionButton from "@/components/common/FloatingActionButton.vue";

defineProps<{
  count: number;
  show: boolean;
}>();
</script>
