<script setup lang="ts">
import { DialogClose, type DialogContentEmits, type DialogContentProps, DialogPortal } from "@kappa-ui/core/dialog";
import { DrawerContent, useDrawerContext } from "@kappa-ui/core/drawer";
import { injectOverlayPortalTarget } from "@kappa-ui/core/overlay";
import IconX from "~icons/tabler/x";
import { useForwardPropsEmits } from "reka-ui";
import { type ComponentPublicInstance, type HTMLAttributes, computed, onBeforeUnmount, useTemplateRef, watch } from "vue";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { drawerContentVariants, drawerSurface } from ".";
import DrawerHandle from "./DrawerHandle.vue";
import DrawerOverlay from "./DrawerOverlay.vue";
import { leaveExitGhosts } from "./exitGhost";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<
    DialogContentProps & { class?: HTMLAttributes["class"]; showHandle?: boolean; showCloseButton?: boolean }
  >(),
  { showHandle: undefined, showCloseButton: false },
);
const emits = defineEmits<DialogContentEmits>();

const delegated = computed(() => {
  const { class: _, showHandle: __, showCloseButton: ___, ...rest } = props;
  return rest;
});
const forwarded = useForwardPropsEmits(delegated, emits);

const portalTarget = injectOverlayPortalTarget(null);
const context = useDrawerContext();
const withHandle = computed(
  () => props.showHandle ?? (context.side.value === "bottom" || context.side.value === "top"),
);

const content = useTemplateRef<ComponentPublicInstance>("content");
const overlay = useTemplateRef<ComponentPublicInstance>("overlay");
// When the close started: the exit copies resume from it if the owner
// unmounts mid-close (see exitGhost).
let closedAt: number | null = null;
watch(context.open, (open) => {
  closedAt = null;
  if (open) return;
  const pending = performance.now();
  closedAt = pending;
  requestAnimationFrame((frameTime) => {
    if (closedAt === pending) closedAt = frameTime;
  });
}, { flush: "post" });
onBeforeUnmount(() => leaveExitGhosts([overlay.value?.$el, content.value?.$el], closedAt));
</script>

<template>
  <DialogPortal :to="portalTarget ?? undefined">
    <DrawerOverlay ref="overlay" />
    <DrawerContent
      ref="content"
      v-bind="{ ...$attrs, ...forwarded }"
      data-slot="drawer-content"
      :class="cn(drawerSurface, drawerContentVariants({ side: context.side.value }), props.class)"
    >
      <DrawerHandle v-if="withHandle" />
      <slot />
      <DialogClose
        v-if="props.showCloseButton"
        as-child
      >
        <Button
          variant="ghost"
          color="neutral"
          size="icon-sm"
          aria-label="Close"
          data-slot="drawer-close"
          class="absolute end-4 top-4"
        >
          <IconX />
        </Button>
      </DialogClose>
    </DrawerContent>
  </DialogPortal>
</template>
