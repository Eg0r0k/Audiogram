<!-- eslint-disable vue/require-default-prop -->
<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import IconCheck from "~icons/tabler/check";
import { cn } from "@/lib/utils";
import { useDrawerMenuClose } from "./context";
import { drawerMenuRowClass } from "./row";

const props = defineProps<{
  checked?: boolean;
  disabled?: boolean;
  class?: HTMLAttributes["class"];
}>();

const emit = defineEmits<{
  "update:checked": [checked: boolean];
}>();

const close = useDrawerMenuClose();

const onClick = () => {
  if (props.disabled) return;
  emit("update:checked", !props.checked);
  close();
};
</script>

<template>
  <button
    v-ripple
    type="button"
    role="menuitemcheckbox"
    data-slot="drawer-menu-checkbox-item"
    :aria-checked="checked === true"
    :data-state="checked ? 'checked' : 'unchecked'"
    :disabled="disabled || undefined"
    :class="cn(drawerMenuRowClass, props.class)"
    @click="onClick"
  >
    <slot />
    <IconCheck
      v-if="checked"
      class="ml-auto size-5 text-primary"
    />
  </button>
</template>
