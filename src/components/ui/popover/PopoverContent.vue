<script setup lang="ts">
import { OverlayScrim, injectOverlayPortalTarget, useModalScrim } from "@kappa-ui/core/overlay";
import {
  PopoverContent,
  type PopoverContentEmits,
  type PopoverContentProps,
  PopoverPortal,
  injectPopoverRootContext,
  useForwardPropsEmits,
} from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";
import { overlaySurface } from ".";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopoverContentProps & { class?: HTMLAttributes["class"] }>(), {
  align: "center",
  sideOffset: 4,
});
const emits = defineEmits<PopoverContentEmits>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
const forwarded = useForwardPropsEmits(delegated, emits);

const rootContext = injectPopoverRootContext();
const scrim = useModalScrim({
  open: rootContext.open,
  modal: rootContext.modal,
  forceMount: () => props.forceMount,
});
const { ModalScrimHold } = scrim;
const portalTarget = injectOverlayPortalTarget(null);
</script>

<template>
  <PopoverPortal :to="portalTarget ?? undefined">
    <OverlayScrim
      :scrim="scrim"
      data-slot="popover-scrim"
      class="z-50"
    />
    <PopoverContent
      v-bind="{ ...$attrs, ...forwarded }"
      data-slot="popover-content"
      :class="
        cn(
          overlaySurface,
          'w-72 max-w-(--reka-popover-content-available-width) p-4 origin-(--reka-popover-content-transform-origin)',
          props.class,
        )
      "
    >
      <slot />
      <ModalScrimHold />
    </PopoverContent>
  </PopoverPortal>
</template>
