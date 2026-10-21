<template>
  <span
    role="alert"
    class="flex items-start gap-1.5 text-sm text-destructive"
  >
    <IconAlertTriangle
      class="mt-0.5 size-4 shrink-0"
      aria-hidden="true"
    />
    <span><slot /></span>
  </span>
</template>

<script setup lang="ts">
import IconAlertTriangle from "~icons/tabler/alert-triangle";
</script>
