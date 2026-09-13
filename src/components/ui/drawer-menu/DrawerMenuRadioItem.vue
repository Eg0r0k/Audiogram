<!-- eslint-disable vue/require-default-prop -->
<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { computed, inject } from "vue";
import IconCheck from "~icons/tabler/check";
import { cn } from "@/lib/utils";
import { drawerMenuRowVariants } from ".";
import { DrawerMenuRadioGroupKey, useDrawerMenuClose } from "./context";

const props = defineProps<{
  value: string;
  disabled?: boolean;
  class?: HTMLAttributes["class"];
}>();

const group = inject(DrawerMenuRadioGroupKey);
if (!group) throw new Error("DrawerMenuRadioItem must be rendered inside DrawerMenuRadioGroup");

const close = useDrawerMenuClose();
const checked = computed(() => group.value() === props.value);

const onClick = () => {
  if (props.disabled) return;
  group.select(props.value);
  close();
};
</script>

<template>
  <button
    v-ripple
    type="button"
    role="menuitemradio"
    data-slot="drawer-menu-radio-item"
    :aria-checked="checked"
    :data-state="checked ? 'checked' : 'unchecked'"
    :disabled="disabled || undefined"
    :class="cn(drawerMenuRowVariants(), props.class)"
    @click="onClick"
  >
    <slot />
    <IconCheck
      v-if="checked"
      class="ml-auto size-5 text-primary"
    />
  </button>
</template>
