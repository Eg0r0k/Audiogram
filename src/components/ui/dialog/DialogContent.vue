<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  type DialogContentEmits,
  type DialogContentProps,
  DialogPortal,
} from "@kappa-ui/core/dialog";
import { injectOverlayPortalTarget } from "@kappa-ui/core/overlay";
import IconX from "~icons/tabler/x";
import { useForwardPropsEmits } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { dialogSurface } from ".";
import DialogOverlay from "./DialogOverlay.vue";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<DialogContentProps & { class?: HTMLAttributes["class"]; showCloseButton?: boolean }>(),
  { showCloseButton: true },
);
const emits = defineEmits<DialogContentEmits>();

const delegated = computed(() => {
  const { class: _, showCloseButton: __, ...rest } = props;
  return rest;
});
const forwarded = useForwardPropsEmits(delegated, emits);

const portalTarget = injectOverlayPortalTarget(null);
</script>

<template>
  <DialogPortal :to="portalTarget ?? undefined">
    <DialogOverlay />
    <DialogContent
      v-bind="{ ...$attrs, ...forwarded }"
      data-slot="dialog-content"
      :class="
        cn(
          `
            fixed top-1/2 left-1/2 z-50 max-h-[calc(100vh-2rem)] supports-[height:100dvh]:max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2
            -translate-y-1/2
          `,
          dialogSurface,
          props.class,
        )
      "
    >
      <slot />
      <DialogClose
        v-if="props.showCloseButton"
        as-child
      >
        <Button
          variant="ghost"
          color="muted"
          size="icon-sm"
          aria-label="Close"
          data-slot="dialog-close"
          class="absolute end-2 top-2 rounded-full opacity-80 icon-size-5 hover:opacity-100"
        >
          <IconX />
        </Button>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
