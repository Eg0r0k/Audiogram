<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Button } from "@/components/ui/button";
import IconX from "~icons/tabler/x";

defineProps<{
  items: readonly string[];
}>();

const emit = defineEmits<{
  apply: [item: string];
  remove: [item: string];
  clear: [];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="flex flex-col gap-2 mt-2">
    <div class="flex items-center justify-between gap-2">
      <p class="text-sm font-medium text-muted-foreground">
        {{ t("search.recentTitle") }}
      </p>
      <Button
        variant="ghost"
        size="icon-sm"
        class="rounded-full"
        @click="emit('clear')"
      >
        <IconX class="size-5" />
      </Button>
    </div>

    <div
      v-for="item in items"
      :key="item"
      v-ripple
      class="flex items-center select-none justify-between gap-3 rounded-md px-2.5 py-2 text-left hover:bg-muted/50"
      role="button"
      tabindex="0"
      @click="emit('apply', item)"
      @keypress.enter="emit('apply', item)"
    >
      <span class="truncate text-sm">{{ item }}</span>
      <button
        class="shrink-0 text-sm text-muted-foreground font-medium hover:text-foreground cursor-pointer"
        @click.stop="emit('remove', item)"
      >
        {{ t("common.remove") }}
</button>
    </div>
  </div>
</template>