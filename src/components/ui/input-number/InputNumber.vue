<script setup lang="ts">
import { NumberFieldRoot, type NumberFieldRootEmits, type NumberFieldRootProps, useForwardPropsEmits } from "reka-ui";
import { type HTMLAttributes, computed, useAttrs } from "vue";

import { useFieldControl } from "@/lib/field-context";
import type { TextControlSize, TextControlVariant } from "@/lib/text-control";
import { cn } from "@/lib/utils";
import { type InputNumberOrientation, inputNumberVariants, provideInputNumberContext } from ".";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<
    NumberFieldRootProps & {
      orientation?: InputNumberOrientation;
      variant?: TextControlVariant;
      size?: TextControlSize;
      class?: HTMLAttributes["class"];
    }
  >(),
  { orientation: "horizontal", variant: "outline", size: "md" },
);
const emits = defineEmits<NumberFieldRootEmits>();

const attrs = useAttrs();
const control = useFieldControl(props, attrs);

const delegated = computed(() => {
  const {
    class: _,
    orientation: __,
    variant: ___,
    size: ____,
    id: _____,
    disabled: ______,
    required: _______,
    ...rest
  } = props;
  return rest;
});
const forwarded = useForwardPropsEmits(delegated, emits);

const inputOwned = ["aria-invalid", "aria-describedby"];
const rootAttrs = computed(() =>
  Object.fromEntries(Object.entries(attrs).filter(([key]) => !inputOwned.includes(key))),
);

provideInputNumberContext(
  computed(() => ({
    variant: props.variant,
    orientation: props.orientation,
    invalid: control.invalid.value,
    required: control.required.value,
    describedBy: control.describedBy.value,
  })),
);
</script>

<template>
  <NumberFieldRoot
    v-bind="{ ...rootAttrs, ...forwarded }"
    :id="control.id.value"
    data-slot="input-number"
    :data-orientation="props.orientation"
    :data-variant="props.variant"
    :data-size="props.size"
    :disabled="control.disabled.value"
    :required="control.required.value"
    :class="
      cn(inputNumberVariants({ variant: props.variant, size: props.size, orientation: props.orientation }), props.class)
    "
  >
    <slot />
  </NumberFieldRoot>
</template>
