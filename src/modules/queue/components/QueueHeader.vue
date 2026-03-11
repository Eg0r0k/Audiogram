<template>
  <div class="flex items-center  border-background border-b justify-between px-4 py-3 ">
    <div>
      <h2 class="text-lg font-bold">
        Очередь
      </h2>
    </div>

    <div
      v-if="!isEmpty"
      class="flex items-center gap-1"
    >
      <Button
        variant="ghost"
        size="icon-lg"
        class="rounded-full"
        :aria-label="$t('queue.clear')"
        @click="$emit('clear')"
      >
        <IconTrash class="size-5" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import IconTrash from "~icons/tabler/trash";

defineProps<{
  size: number;
  isEmpty: boolean;
  isShuffled: boolean;
}>();

defineEmits<{
  shuffle: [];
  clear: [];
}>();
</script>
