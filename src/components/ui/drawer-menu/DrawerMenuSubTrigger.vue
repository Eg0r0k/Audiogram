<!-- eslint-disable vue/require-default-prop -->
<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { computed } from "vue";
import IconChevronDown from "~icons/tabler/chevron-down";
import { cn } from "@/lib/utils";
import { useDrawerMenuSub } from "./context";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();

const sub = useDrawerMenuSub();
const isOpen = computed(() => sub.open.value);
</script>

<template>
  <button
    v-ripple
    type="button"
    data-slot="drawer-menu-sub-trigger"
    :data-state="isOpen ? 'open' : 'closed'"
    :aria-expanded="isOpen"
    :class="cn(
      'press-scale relative flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-base font-medium text-foreground outline-none select-none',
      'hover:bg-accent active:bg-accent focus-visible:bg-accent',
      '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'text-\'])]:text-muted-foreground',
      props.class,
    )"
    @click="sub.setOpen(!isOpen)"
  >
    <slot />
    <IconChevronDown
      class="ml-auto size-5 transition-transform duration-200 ease-out"
      :class="isOpen && 'rotate-180'"
    />
  </button>
</template>
