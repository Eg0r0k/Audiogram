<script setup lang="ts">
import {
  CheckboxGroupRoot,
  type CheckboxGroupRootEmits,
  type CheckboxGroupRootProps,
  useForwardPropsEmits,
} from "reka-ui";
import { type HTMLAttributes, computed, useAttrs } from "vue";

import { useFieldControl } from "@/lib/field-context";
import { ChoiceGroup, type ChoiceGroupVariants } from "@/components/ui/choice-group";
import { type CheckboxColor, provideCheckboxGroupContext } from ".";

const props = withDefaults(
  defineProps<
    CheckboxGroupRootProps & {
      variant?: ChoiceGroupVariants["variant"];
      /** The tone of every checkbox in the group that doesn't set its own. */
      color?: CheckboxColor | (string & {});
      class?: HTMLAttributes["class"];
    }
  >(),
  { rovingFocus: false, color: "primary" },
);
const emits = defineEmits<CheckboxGroupRootEmits>();

const delegated = computed(() => {
  const { class: _, variant: __, color: ___, ...rest } = props;
  return rest;
});
const forwarded = useForwardPropsEmits(delegated, emits);

const control = useFieldControl(props, useAttrs());

provideCheckboxGroupContext({ color: computed(() => props.color) });
</script>

<template>
  <ChoiceGroup
    as-child
    :variant="props.variant"
    :orientation="props.orientation"
    :color="props.color"
    :class="props.class"
  >
    <CheckboxGroupRoot
      v-bind="forwarded"
      data-slot="checkbox-group"
      :disabled="control.disabled.value"
      :aria-invalid="control.invalid.value"
      :aria-describedby="control.describedBy.value"
    >
      <slot />
    </CheckboxGroupRoot>
  </ChoiceGroup>
</template>
