<script setup lang="ts">
import { TabsContent, type TabsContentProps } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";
import { tabsContent } from ".";

const props = defineProps<TabsContentProps & { class?: HTMLAttributes["class"] }>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <TabsContent
    v-bind="delegated"
    data-slot="tabs-content"
    :class="cn(tabsContent, props.class)"
  >
    <slot />
  </TabsContent>
</template>
