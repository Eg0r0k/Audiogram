<script setup lang="ts">
import { OverlayScrim, injectOverlayPortalTarget, useModalScrim } from "@kappa-ui/core/overlay";
import {
  SelectContent,
  type SelectContentEmits,
  type SelectContentProps,
  SelectPortal,
  SelectViewport,
  injectSelectRootContext,
  useForwardPropsEmits,
} from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";
import { menuSizeVariants } from "@/components/ui/menu";
import { overlaySurface } from "@/components/ui/popover";
import { type SelectSize, injectSelectSize } from ".";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectContentProps & { size?: SelectSize; class?: HTMLAttributes["class"] }>(), {
  position: "popper",
  sideOffset: 4,
  disableOutsidePointerEvents: true,
});
const emits = defineEmits<SelectContentEmits>();

const delegated = computed(() => {
  const { class: _, size: __, ...rest } = props;
  return rest;
});
const forwarded = useForwardPropsEmits(delegated, emits);

const rootContext = injectSelectRootContext();
const scrim = useModalScrim({
  open: rootContext.open,
  modal: () => props.disableOutsidePointerEvents,
  forceMount: () => props.forceMount,
});
const { ModalScrimHold } = scrim;
const portalTarget = injectOverlayPortalTarget(null);

const triggerSize = injectSelectSize(null);
const size = computed(() => props.size ?? triggerSize?.value ?? "md");
</script>

<template>
  <SelectPortal :to="portalTarget ?? undefined">
    <OverlayScrim
      :scrim="scrim"
      data-slot="select-scrim"
      class="z-50"
    />
    <SelectContent
      v-bind="{ ...$attrs, ...forwarded }"
      data-slot="select-content"
      :data-size="size"
      :class="
        cn(
          overlaySurface,
          menuSizeVariants({ size }),
          `
            relative flex max-h-(--reka-select-content-available-height) min-w-32 flex-col overflow-hidden p-0
            origin-(--reka-select-content-transform-origin)
          `,
          props.class,
        )
      "
    >
      <ModalScrimHold />
      <SelectViewport
        data-slot="select-viewport"
        :class="
          cn(
            'flex flex-col p-(--menu-pad) [scrollbar-width:thin]!',
            props.position === 'popper' &&
              'h-(--reka-select-trigger-height) w-full min-w-(--reka-select-trigger-width) scroll-my-1',
          )
        "
      >
        <slot />
      </SelectViewport>
    </SelectContent>
  </SelectPortal>
</template>
