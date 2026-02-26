<script lang="ts" setup>
import type { ToasterProps } from "vue-sonner";
import { Toaster as Sonner } from "vue-sonner";
import { cn } from "@/lib/utils";

import IconCheck from "~icons/tabler/check";
import IconInfoCircle from "~icons/tabler/info-circle";
import IconAlertTriangle from "~icons/tabler/alert-triangle";
import IconCircleX from "~icons/tabler/circle-x";
import IconLoader2 from "~icons/tabler/loader-2";
import IconX from "~icons/tabler/x";

const props = defineProps<ToasterProps>();
</script>

<template>
  <Sonner
    :class="cn('toaster group', props.class)"
    :style="{ '--normal-bg': 'var(--popover)', '--normal-text': 'var(--popover-foreground)', '--normal-border': 'var(--border)', '--border-radius': 'var(--radius)', }"
    v-bind="props"
  >
    <template #success-icon>
      <IconCheck class="size-5" />
    </template>
    <template #info-icon>
      <IconInfoCircle class="size-5" />
    </template>
    <template #warning-icon>
      <IconAlertTriangle class="size-5" />
    </template>
    <template #error-icon>
      <IconCircleX class="size-5" />
    </template>
    <template #loading-icon>
      <div>
        <IconLoader2 class="size-5 animate-spin" />
      </div>
    </template>
    <template #close-icon>
      <IconX class="size-5" />
    </template>
  </Sonner>
</template>

<style>
[data-sonner-toast] {
  opacity: 0.8;
  backdrop-filter: blur(50px);
  -webkit-backdrop-filter: blur(50px);
  border: none !important;
}
</style>
