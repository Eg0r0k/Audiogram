<template>
  <Scrollable class="flex-1">
    <div class="flex w-full items-center justify-between px-4 pt-4">
      <span class=" text-lg font-medium">
        {{ $t('library.title') }}
      </span>
      <div class="flex gap-1">
        <Button
          variant="ghost"
          class=" rounded-full"
          size="icon"
        >
          <IconSearch class="size-5" />
        </Button>
        <Button
          variant="ghost"
          class=" rounded-full"
          size="icon"
        >
          <IconPlus class="size-5" />
        </Button>
      </div>
    </div>
    <div class="px-4 ">
      adsas
    </div>
  </Scrollable>
</template>
<script setup lang="ts">
import { Button } from "@/components/ui/button";
import Scrollable from "@/components/ui/scrollable/Scrollable.vue";
import IconPlus from "~icons/tabler/plus";
import IconSearch from "~icons/tabler/search";

</script>
