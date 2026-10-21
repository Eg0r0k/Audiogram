<script setup lang="ts">
import { type Color, colorToString, convertToHsb, isValidColor, parseColor } from "reka-ui";
import { type HTMLAttributes, computed, nextTick, ref, toRef, useAttrs, watch } from "vue";

import { useFieldControl } from "@/lib/field-context";
import { cn } from "@/lib/utils";
import { type ColorPickerFormat, type ColorPickerSize, colorPickerVariants, provideColorPickerContext } from ".";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    id?: string;
    defaultValue?: string;
    format?: ColorPickerFormat;
    size?: ColorPickerSize;
    disabled?: boolean;
    required?: boolean;
    name?: string;
    class?: HTMLAttributes["class"];
  }>(),
  { format: "hex", size: "md" },
);

const model = defineModel<string>();

const attrs = useAttrs();
const control = useFieldControl(props, attrs);

const parse = (value: string | undefined) =>
  value !== undefined && isValidColor(value) ? convertToHsb(parseColor(value)) : undefined;

const color = ref<Color>(parse(model.value) ?? parse(props.defaultValue) ?? parse("#ffffff")!);
const sync = (next: string | undefined) => {
  if (next === undefined || next === colorToString(color.value, props.format)) return;
  const parsed = parse(next);
  if (parsed) color.value = parsed;
};

const setColor = (next: Color) => {
  color.value = convertToHsb(next);
  model.value = colorToString(next, props.format);
  nextTick(() => sync(model.value));
};
if (model.value === undefined) setColor(color.value);

watch(model, sync);
watch(
  () => props.format,
  () => setColor(color.value),
);

const isDisabled = computed(() => Boolean(control.disabled.value));

provideColorPickerContext({
  color,
  hex: computed(() => colorToString(color.value, "hex")),
  opaque: computed(() => colorToString({ ...color.value, alpha: 1 }, "hex")),
  setColor,
  size: toRef(() => props.size),
  disabled: isDisabled,
  invalid: control.invalid,
  describedBy: control.describedBy,
});

const partOwned = ["aria-invalid", "aria-describedby"];
const rootAttrs = computed(() => Object.fromEntries(Object.entries(attrs).filter(([key]) => !partOwned.includes(key))));
</script>

<template>
  <div
    v-bind="rootAttrs"
    :id="control.id.value"
    data-slot="color-picker"
    role="group"
    :data-size="props.size"
    :data-disabled="isDisabled ? '' : undefined"
    :aria-labelledby="control.labelledBy.value"
    :aria-required="control.required.value || undefined"
    :class="cn(colorPickerVariants({ size: props.size }), props.class)"
  >
    <slot />
    <input
      v-if="props.name"
      type="hidden"
      :name="props.name"
      :value="model"
      :disabled="isDisabled"
    >
  </div>
</template>
