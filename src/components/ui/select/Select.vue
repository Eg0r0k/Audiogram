<script setup lang="ts">
import { SelectRoot, type SelectRootEmits, type SelectRootProps, useForwardPropsEmits } from "reka-ui";
import { ref, useAttrs } from "vue";

import { useFieldControl } from "@/lib/field-context";
import { type SelectSize, provideSelectSize } from ".";

const props = defineProps<SelectRootProps>();
const emits = defineEmits<SelectRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);
const control = useFieldControl(props, useAttrs());

provideSelectSize(ref<SelectSize>());
</script>

<template>
  <SelectRoot
    v-slot="slotProps"
    v-bind="forwarded"
    :disabled="control.disabled.value"
    :required="control.required.value"
  >
    <slot v-bind="slotProps" />
  </SelectRoot>
</template>
