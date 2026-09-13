<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useDrawerMenuSub } from "./context";

// Popper sub-contents carry width classes (`w-56`) that must not constrain
// a full-width sheet, so attributes are dropped on purpose.
defineOptions({ inheritAttrs: false });

const sub = useDrawerMenuSub();
const isOpen = computed(() => sub.open.value);

// Content mounts on first expand only, so lazy queries behind `update:open`
// are not started by a sheet that merely rendered the trigger.
const hasOpened = ref(false);
watch(isOpen, (open) => {
  if (open) hasOpened.value = true;
}, { immediate: true });
</script>

<template>
  <div
    data-slot="drawer-menu-sub-content"
    :data-state="isOpen ? 'open' : 'closed'"
    class="grid transition-[grid-template-rows] duration-200 ease-out"
    :style="{ gridTemplateRows: isOpen ? '1fr' : '0fr' }"
  >
    <div class="min-h-0 overflow-hidden">
      <div
        v-if="hasOpened"
        class="pb-1 pl-3"
      >
        <slot />
      </div>
    </div>
  </div>
</template>
