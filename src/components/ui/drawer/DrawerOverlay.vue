<!-- eslint-disable vue/require-default-prop -->
<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { DrawerOverlay } from "vaul-vue";
import { cn } from "@/lib/utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <DrawerOverlay
    data-slot="drawer-overlay"
    :class="cn('fixed inset-0 z-(--z-dialog) bg-[#0000004d]', props.class)"
  />
</template>
