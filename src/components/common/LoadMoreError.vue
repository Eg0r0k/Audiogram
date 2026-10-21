<template>
  <div class="flex flex-wrap items-center justify-center gap-x-2 py-3">
    <p
      role="alert"
      class="text-sm text-destructive"
    >
      {{ $t("errors.loadMoreFailed") }}
    </p>
    <Button
      variant="ghost"
      color="muted"
      size="sm"
      @click="emit('retry')"
    >
      {{ $t("common.retry") }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";

const emit = defineEmits<{
  retry: [];
}>();
</script>
