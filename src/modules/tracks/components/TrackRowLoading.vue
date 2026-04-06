<script setup lang="ts">
import Skeleton from "@/components/ui/skeleton/Skeleton.vue";

interface Props {
  rows?: number;
  compact?: boolean;
  draggable?: boolean;
}

withDefaults(defineProps<Props>(), {
  rows: 3,
  compact: false,
  draggable: false,
});
</script>

<template>
  <div class="w-full">
    <div
      v-for="i in rows"
      :key="i"
      :data-compact="compact"
      class="group flex items-center gap-3 w-full rounded select-none px-2.5 h-16 data-[compact=true]:h-8"
    >
      <template v-if="draggable">
        <Skeleton class="shrink-0 w-8 h-8 rounded-md" />
      </template>
      <template v-else>
        <Skeleton class="shrink-0 w-8 h-5 rounded-md data-[compact=true]:w-6" />
      </template>

      <Skeleton
        class="relative shrink-0 size-10 rounded object-cover group-data-[compact=true]:hidden"
      />

      <div class="flex-1 min-w-0 flex flex-col gap-2 group-data-[compact=true]:flex-row group-data-[compact=true]:items-center group-data-[compact=true]:gap-2">
        <Skeleton class="h-4 w-[38%] rounded-md group-data-[compact=true]:h-3 group-data-[compact=true]:w-[28%]" />
        <Skeleton class="h-3 w-[52%] rounded-md group-data-[compact=true]:h-3 group-data-[compact=true]:w-[22%]" />
      </div>

      <div class="w-7 flex justify-end items-center relative">
        <Skeleton class="h-3 w-7 rounded-md hidden sm:block" />
      </div>
    </div>
  </div>
</template>
