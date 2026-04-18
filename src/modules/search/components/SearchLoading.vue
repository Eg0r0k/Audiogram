<script setup lang="ts">
import Skeleton from "@/components/ui/skeleton/Skeleton.vue";
</script>

<template>
  <div class="flex-1 gap-2 flex flex-col p-2">
    <div
      v-for="i in 3"
      :key="i"
      class="flex items-center gap-3 px-2"
    >
      <Skeleton class="size-[54px] rounded-full shrink-0" />
      <div class="flex flex-col gap-2 w-full">
        <Skeleton class="h-3 w-[40%]" />
        <Skeleton class="h-3 w-[65%]" />
      </div>
    </div>
  </div>
</template>
