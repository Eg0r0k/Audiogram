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
    role="group"
    data-slot="drawer-menu-group"
    :class="cn(props.class)"
  >
    <slot />
  </div>
</template>
