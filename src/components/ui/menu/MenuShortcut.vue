<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";
import { menuShortcut } from ".";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <span
    data-slot="menu-shortcut"
    dir="ltr"
    :class="cn(menuShortcut, props.class)"
  >
    <slot />
  </span>
</template>
