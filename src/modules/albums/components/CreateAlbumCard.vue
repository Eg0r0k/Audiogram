<template>
  <div
    v-ripple
    class="group w-40 shrink-0 select-none cursor-pointer rounded-lg p-2 outline-none transition-colors hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-44"
    role="button"
    tabindex="0"
    :aria-label="$t('common.createAlbum')"
    @click="emit('create')"
    @keydown.enter="emit('create')"
  >
    <div class="flex aspect-square items-center justify-center rounded-md border-2 border-dashed border-border bg-muted/60 text-muted-foreground transition-colors group-hover:border-foreground/40 group-hover:text-foreground">
      <IconPlus class="size-10 transition-transform duration-200 group-hover:scale-110" />
    </div>

    <div class="mt-3 min-w-0">
      <p class="truncate text-sm font-medium text-foreground">
        {{ $t('common.createAlbum') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import IconPlus from "~icons/tabler/plus";

const emit = defineEmits<{
  create: [];
}>();
</script>
