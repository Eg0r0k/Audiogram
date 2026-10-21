<script setup lang="ts">
import { MenuPortal, MenuSubContent, type MenuSubContentEmits, type MenuSubContentProps } from "@kappa-ui/core/menu";
import { injectOverlayPortalTarget } from "@kappa-ui/core/overlay";
import { useForwardPropsEmits } from "reka-ui";
import { type HTMLAttributes, computed, toRef } from "vue";

import { cn } from "@/lib/utils";
import { overlaySurface } from "@/components/ui/popover";
import { type MenuSize, injectMenuSize, menuSizeVariants, provideMenuSize } from ".";

defineOptions({ inheritAttrs: false });

const props = defineProps<MenuSubContentProps & { size?: MenuSize; class?: HTMLAttributes["class"] }>();
const emits = defineEmits<MenuSubContentEmits>();

const delegated = computed(() => {
  const { class: _, size: __, ...rest } = props;
  return rest;
});
const forwarded = useForwardPropsEmits(delegated, emits);
const portalTarget = injectOverlayPortalTarget(null);

const parentSize = injectMenuSize(null);
const size = toRef(() => props.size ?? parentSize?.value ?? "md");
provideMenuSize(size);
</script>

<template>
  <MenuPortal :to="portalTarget ?? undefined">
    <MenuSubContent
      v-bind="{ ...$attrs, ...forwarded }"
      data-slot="menu-sub-content"
      :data-size="size"
      :class="
        cn(
          overlaySurface,
          `
            max-h-(--reka-popper-available-height) flex min-w-32 flex-col overflow-x-hidden overflow-y-auto
            origin-(--reka-popper-transform-origin)
          `,
          menuSizeVariants({ size }),
          props.class,
        )
      "
    >
      <slot />
    </MenuSubContent>
  </MenuPortal>
</template>
