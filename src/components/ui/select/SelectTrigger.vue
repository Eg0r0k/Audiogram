<script setup lang="ts">
import IconChevronDown from "~icons/tabler/chevron-down";
import { SelectIcon, SelectTrigger, type SelectTriggerProps, useForwardProps } from "reka-ui";
import { type HTMLAttributes, computed, useAttrs, watchEffect } from "vue";

import { useFieldControl } from "@/lib/field-context";
import { cn } from "@/lib/utils";
import { type SelectSize, type SelectTriggerVariants, injectSelectSize, selectTriggerVariants } from ".";

const props = withDefaults(
  defineProps<
    SelectTriggerProps & {
      id?: string;
      variant?: SelectTriggerVariants["variant"];
      size?: SelectSize;
      class?: HTMLAttributes["class"];
    }
  >(),
  { size: "md" },
);

const delegated = computed(() => {
  const { class: _, variant: __, size: ___, id: ____, ...rest } = props;
  return rest;
});
const forwarded = useForwardProps(delegated);

const control = useFieldControl(props, useAttrs());

const sharedSize = injectSelectSize(null);
watchEffect(() => {
  if (sharedSize) sharedSize.value = props.size;
});
</script>

<template>
  <SelectTrigger
    v-bind="forwarded"
    :id="control.id.value"
    data-slot="select-trigger"
    :data-variant="props.variant ?? 'outline'"
    :data-size="props.size"
    :disabled="control.disabled.value"
    :aria-invalid="control.invalid.value"
    :aria-describedby="control.describedBy.value"
    :class="cn(selectTriggerVariants({ variant: props.variant, size: props.size }), props.class)"
  >
    <slot />
    <SelectIcon as-child>
      <IconChevronDown class="text-muted-foreground transition-[rotate] duration-short-4 ease-standard group-data-[state=open]/select-trigger:rotate-180 group-disabled/select-trigger:text-foreground/(--disabled-opacity) motion-reduce:transition-none" />
    </SelectIcon>
  </SelectTrigger>
</template>
