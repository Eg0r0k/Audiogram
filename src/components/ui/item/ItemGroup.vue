<script setup lang="ts">
import { type HTMLAttributes, computed, useAttrs } from "vue";

import { cn } from "@/lib/utils";
import { provideItemGroupContext } from ".";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();

const attrs = useAttrs();
const role = computed(() => (attrs.role as string | undefined) ?? "list");

provideItemGroupContext({ list: computed(() => role.value === "list") });
</script>

<template>
  <div
    data-slot="item-group"
    :role="role"
    :class="cn('group/item-group flex flex-col', props.class)"
  >
    <slot />
  </div>
</template>
