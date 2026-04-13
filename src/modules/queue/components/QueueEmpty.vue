<template>
  <div class="flex flex-col items-center justify-center  h-full text-center">
    <div class="size-16 flex items-center justify-center ">
      <IconPlaylist class="size-8 text-primary" />
    </div>
    <h3 class="text-xl font-medium ">
      {{ $t("common.empty") }}
    </h3>
    <p class=" text-muted-foreground max-w-60">
      {{ $t("player.emptyDescription") }}
    </p>
  </div>
</template>

<script setup lang="ts">
import IconPlaylist from "~icons/tabler/playlist";
</script>
