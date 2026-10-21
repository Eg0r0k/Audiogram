<script setup lang="ts">
import { DrawerRoot, type DrawerRootEmits, type DrawerRootProps } from "@kappa-ui/core/drawer";
import { useForwardPropsEmits } from "reka-ui";
import { ref, watch } from "vue";

import { registerOverlayBackHandler } from "@/composables/useOverlayBackButton";

const props = defineProps<DrawerRootProps>();
const emits = defineEmits<DrawerRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);

// Android's hardware back dismisses an open drawer through its own Escape
// path, so focus restoration and the exit animation match a normal close.
const isOpen = ref(props.open ?? props.defaultOpen ?? false);
watch(() => props.open, (open) => {
  if (open !== undefined) isOpen.value = open;
});
registerOverlayBackHandler({
  depth: () => (isOpen.value ? 1 : 0),
  back: () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  },
});
</script>

<template>
  <DrawerRoot
    v-slot="slotProps"
    v-bind="forwarded"
    @update:open="isOpen = $event"
  >
    <slot v-bind="slotProps" />
  </DrawerRoot>
</template>
