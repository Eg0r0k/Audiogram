<script setup lang="ts">
import { ColorFieldInput, ColorFieldRoot, type ColorFieldRootProps } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";
import { type InputVariants, inputVariants } from "@/components/ui/input";
import { injectColorPickerContext } from ".";

const props = withDefaults(
  defineProps<
    Omit<ColorFieldRootProps, "modelValue" | "defaultValue" | "disabled"> & {
      variant?: InputVariants["variant"];
      class?: HTMLAttributes["class"];
    }
  >(),
  { colorSpace: "hsb" },
);

const context = injectColorPickerContext();

const delegated = computed(() => {
  const { class: _, variant: __, ...rest } = props;
  return rest;
});
</script>

<template>
  <ColorFieldRoot
    v-bind="delegated"
    data-slot="color-picker-field"
    :model-value="context.color.value"
    :disabled="context.disabled.value"
    :class="cn('flex min-w-0 flex-1', props.class)"
    @update:color="context.setColor"
  >
    <ColorFieldInput
      data-slot="color-picker-field-input"
      :data-variant="props.variant ?? 'outline'"
      :aria-invalid="context.invalid.value"
      :aria-describedby="context.describedBy.value"
      :class="cn(inputVariants({ variant: props.variant, size: context.size.value }), 'font-mono')"
    />
  </ColorFieldRoot>
</template>
