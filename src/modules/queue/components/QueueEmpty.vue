<template>
  <div class="flex flex-col items-center justify-center py-7 h-full text-center">
    <div class="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
      <IconPlaylist class="size-8 text-muted-foreground" />
    </div>
    <h3 class="text-base font-medium mb-1">
      {{ $t("queue.empty.title") }}
    </h3>
    <p class="text-sm text-muted-foreground max-w-[240px]">
      {{ $t("queue.empty.description") }}
    </p>
  </div>
</template>

<script setup lang="ts">
import IconPlaylist from "~icons/tabler/playlist";
</script>
