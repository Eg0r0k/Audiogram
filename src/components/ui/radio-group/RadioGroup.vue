<script setup lang="ts">
import { RadioGroupRoot, type RadioGroupRootEmits, type RadioGroupRootProps, useForwardPropsEmits } from "reka-ui";
import { type HTMLAttributes, computed, useAttrs } from "vue";

import { useFieldControl } from "@/lib/field-context";
import { ChoiceGroup, type ChoiceGroupVariants } from "@/components/ui/choice-group";
import { type RadioColor, provideRadioGroupContext } from ".";

const props = withDefaults(
  defineProps<
    RadioGroupRootProps & {
      variant?: ChoiceGroupVariants["variant"];
      /** The tone of every radio in the group that doesn't set its own. */
      color?: RadioColor | (string & {});
      class?: HTMLAttributes["class"];
    }
  >(),
  { color: "primary" },
);
const emits = defineEmits<RadioGroupRootEmits>();

const delegated = computed(() => {
  const { class: _, variant: __, color: ___, ...rest } = props;
  return rest;
});
const forwarded = useForwardPropsEmits(delegated, emits);

const control = useFieldControl(props, useAttrs());

provideRadioGroupContext({ color: computed(() => props.color) });
</script>

<template>
  <ChoiceGroup
    as-child
    :variant="props.variant"
    :orientation="props.orientation"
    :color="props.color"
    :class="props.class"
  >
    <RadioGroupRoot
      v-bind="forwarded"
      data-slot="radio-group"
      :disabled="control.disabled.value"
      :required="control.required.value"
      :aria-invalid="control.invalid.value"
      :aria-describedby="control.describedBy.value"
    >
      <slot />
    </RadioGroupRoot>
  </ChoiceGroup>
</template>
