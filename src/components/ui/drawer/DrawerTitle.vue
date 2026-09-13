<!-- eslint-disable vue/require-default-prop -->
<script setup lang="ts">
import type { DrawerTitleProps } from "vaul-vue";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { DrawerTitle } from "vaul-vue";
import { cn } from "@/lib/utils";

const props = defineProps<DrawerTitleProps & {
  class?: HTMLAttributes["class"];
}>();

const delegatedProps = reactiveOmit(props, "class");
</script>

<template>
  <DrawerTitle
    data-slot="drawer-title"
    v-bind="delegatedProps"
    :class="cn('text-base font-semibold', props.class)"
  >
    <slot />
  </DrawerTitle>
</template>
