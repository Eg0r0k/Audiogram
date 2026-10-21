<script setup lang="ts">
import { DrawerIndent } from "@kappa-ui/core/drawer";
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div
    data-slot="drawer-indent"
    :class="cn('bg-black', props.class)"
  >
    <DrawerIndent
      data-slot="drawer-indent-page"
      class="bg-background drawer-indent"
    >
      <slot />
    </DrawerIndent>
  </div>
</template>
