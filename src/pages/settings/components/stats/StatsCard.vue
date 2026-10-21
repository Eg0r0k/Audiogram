<template>
  <div class="flex min-w-0 flex-col rounded-xl bg-muted p-4">
    <div
      v-if="$slots.media"
      class="mb-2"
    >
      <slot name="media" />
    </div>
    <span
      v-if="label"
      class="mb-1.5 text-sm font-medium text-muted-foreground"
    >{{ label }}</span>
    <span class="truncate text-xl font-bold leading-tight tabular-nums text-foreground">
      <slot>{{ value }}</slot>
    </span>
    <span
      v-if="caption"
      class="truncate text-sm font-medium leading-tight text-muted-foreground"
    >{{ caption }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label?: string;
  value?: string;
  caption?: string;
}>();
</script>
