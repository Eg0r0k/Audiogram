<!-- eslint-disable vue/require-default-prop -->
<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <div
    role="separator"
    data-slot="drawer-menu-separator"
    :class="cn('my-1 h-px bg-muted', props.class)"
  />
</template>
