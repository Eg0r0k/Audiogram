<template>
  <div class="flex items-center gap-2 px-4 min-h-16  py-3">
    <Button
      v-if="showBack"
      size="icon"
      variant="ghost"
      class="shrink-0 rounded-full "
      @click="emit('back')"
    >
      <IconChevronLeft class="size-6" />
    </Button>

    <div class="min-w-0 flex-1">
      <h2 class="truncate text-lg font-bold">
        {{ title }}
      </h2>
      <p
        v-if="description"
        class="mt-0.5 text-xs text-muted-foreground"
      >
        {{ description }}
      </p>
    </div>

    <Button
      v-if="showClose"
      size="icon"
      variant="ghost"
      class="shrink-0 rounded-full"
      @click="emit('close')"
    >
      <IconX class="size-6" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import IconChevronLeft from "~icons/tabler/arrow-left";
import IconX from "~icons/tabler/x";

withDefaults(defineProps<{
  title: string;
  description?: string | null;
  showBack?: boolean;
  showClose?: boolean;
}>(), {
  description: null,
  showBack: false,
  showClose: false,
});

const emit = defineEmits<{
  back: [];
  close: [];
}>();
</script>
