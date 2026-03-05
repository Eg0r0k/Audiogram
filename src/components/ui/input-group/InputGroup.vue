<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <div
    data-slot="input-group"
    role="group"
    :class="
      cn(
        'audiogram-input-group',
        'relative flex w-full items-center rounded-md  outline-none',
        'h-9 min-w-0 has-[>textarea]:h-auto',

        'has-[>[data-align=inline-start]]:[&>input]:pl-2',
        'has-[>[data-align=inline-end]]:[&>input]:pr-2',
        'has-[>[data-align=block-start]]:flex-col',
        'has-[>[data-align=block-end]]:flex-col',

        props.class
      )
    "
  >
    <slot />
  </div>
</template>

<style scoped>
.audiogram-input-group {
  border: 1px solid var(--border);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.audiogram-input-group:hover:not(:focus-within):not([aria-invalid="true"]) {
  border-color: var(--primary);
}

.audiogram-input-group:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary);
}

.audiogram-input-group[aria-invalid="true"] {
  border-color: var(--destructive);
}

.audiogram-input-group[aria-invalid="true"]:focus-within {
  box-shadow: 0 0 0 1px var(--destructive);
}

</style>
