<script setup lang="ts">
import { TabsTrigger, type TabsTriggerProps } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import vRipple from "@/lib/ripple";
import { cn } from "@/lib/utils";
import { tabsTrigger } from ".";

const props = defineProps<TabsTriggerProps & { class?: HTMLAttributes["class"] }>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <TabsTrigger
    v-ripple
    v-bind="delegated"
    data-slot="tabs-trigger"
    :class="cn(tabsTrigger, props.class)"
  >
    <slot />
  </TabsTrigger>
</template>
