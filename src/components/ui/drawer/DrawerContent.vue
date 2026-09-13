<!-- eslint-disable vue/require-default-prop -->
<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { DrawerContent, DrawerHandle, DrawerPortal } from "vaul-vue";
import { computed } from "vue";
import { cn } from "@/lib/utils";
import { useSafeAreaInsets } from "@/composables/useSafeAreaInsets";
import DrawerOverlay from "./DrawerOverlay.vue";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();

// Edge-to-edge Android lays the sheet under the navigation bar; the inset
// keeps the last row tappable.
const { bottom } = useSafeAreaInsets();
const paddingBottom = computed(() => `${Math.max(bottom.value, 8)}px`);
</script>

<template>
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerContent
      data-slot="drawer-content"
      :class="cn('bg-card text-card-foreground fixed inset-x-0 bottom-0 z-(--z-dialog) flex max-h-[85dvh] flex-col rounded-t-2xl outline-none', props.class)"
      :style="{ paddingBottom }"
    >
      <div class="flex shrink-0 justify-center py-3">
        <DrawerHandle class="relative h-1.5 w-10 cursor-grab rounded-full bg-muted-foreground/30 active:cursor-grabbing" />
      </div>
      <slot />
    </DrawerContent>
  </DrawerPortal>
</template>
