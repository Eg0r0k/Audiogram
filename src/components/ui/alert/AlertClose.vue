<script setup lang="ts">
import IconX from "~icons/tabler/x";
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { alertCloseSize, injectAlertContext } from ".";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();

const { close, size } = injectAlertContext();
</script>

<template>
  <Button
    data-slot="alert-close"
    type="button"
    variant="ghost"
    color="neutral"
    :size="alertCloseSize[size]"
    aria-label="Close"
    :class="
      cn(
        `
          absolute end-[calc(var(--alert-pad)/2)] top-[calc(var(--alert-pad)+var(--alert-line)/2)] -translate-y-1/2
          text-current [--focus-ring-color:currentColor]
          group-data-[orientation=horizontal]/alert:top-1/2
        `,
        props.class,
      )
    "
    @click="close"
  >
    <slot>
      <IconX />
    </slot>
  </Button>
</template>
