<script setup lang="ts">
import { injectOverlayPortalTarget } from "@kappa-ui/core/overlay";
import {
  TooltipContent,
  type TooltipContentEmits,
  type TooltipContentProps,
  TooltipPortal,
} from "@kappa-ui/core/tooltip";
import { useForwardPropsEmits } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TooltipContentProps & { class?: HTMLAttributes["class"] }>(), {
  sideOffset: 4,
  collisionPadding: 8,
});
const emits = defineEmits<TooltipContentEmits>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
const forwarded = useForwardPropsEmits(delegated, emits);
const portalTarget = injectOverlayPortalTarget(null);
</script>

<template>
  <TooltipPortal :to="portalTarget ?? undefined">
    <TooltipContent
      v-bind="{ ...$attrs, ...forwarded }"
      data-slot="tooltip-content"
      :class="
        cn(
          `
            z-50 w-fit max-w-xs origin-(--reka-tooltip-content-transform-origin) rounded-surface-xs bg-foreground px-3
            py-1.5 text-body-sm shadow-shadow-lg text-balance text-background animate-overlay
            data-touch:px-4 data-touch:py-2 data-touch:text-body-md
          `,
          props.class,
        )
      "
    >
      <slot />
    </TooltipContent>
  </TooltipPortal>
</template>
