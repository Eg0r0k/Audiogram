<template>
  <div class="flex flex-col items-center justify-center py-7 h-full text-center">
    <div class="size-16 rounded-full bg-muted flex items-center justify-center mb-2">
      <IconPlaylist class="size-8 text-primary" />
    </div>
    <h3 class="text-lg font-medium ">
      {{ $t("common.empty") }}
    </h3>
    <p class=" font-medium text-muted-foreground max-w-60">
      {{ $t("player.emptyDescription") }}
    </p>
  </div>
</template>

<script setup lang="ts">
import IconPlaylist from "~icons/tabler/playlist";
</script>
