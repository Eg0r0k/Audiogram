<script setup lang="ts">
import { SliderRoot, type SliderRootProps, useForwardProps } from "reka-ui";
import { type HTMLAttributes, computed, useAttrs } from "vue";

import { useFieldControl } from "@/lib/field-context";
import { cn } from "@/lib/utils";
import { type SliderColor, type SliderSize, type SliderVariants, provideSliderContext, sliderVariants } from ".";
import SliderRange from "./SliderRange.vue";
import SliderThumb from "./SliderThumb.vue";
import SliderTrack from "./SliderTrack.vue";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<
    Omit<SliderRootProps, "modelValue" | "defaultValue" | "as" | "asChild"> & {
      id?: string;
      defaultValue?: number | number[];
      variant?: SliderVariants["variant"];
      color?: SliderColor | (string & {});
      size?: SliderSize;
      touchTarget?: SliderVariants["touchTarget"];
      class?: HTMLAttributes["class"];
    }
  >(),
  { color: "primary", size: "md" },
);
const emits = defineEmits<{ valueCommit: [value: number | number[]] }>();
defineSlots<{ default?: (props: { thumbs: number; values: number[] }) => unknown }>();

const model = defineModel<number | number[]>();
if (model.value === undefined) model.value = props.defaultValue ?? props.min ?? 0;

const delegated = computed(() => {
  const {
    class: _,
    size: __,
    touchTarget: ___,
    defaultValue: ____,
    id: _____,
    variant: ______,
    color: _______,
    ...rest
  } = props;
  return rest;
});
const forwarded = useForwardProps(delegated);

const attrs = useAttrs();
const control = useFieldControl(props, attrs);

const values = computed(() => (Array.isArray(model.value) ? model.value : [model.value ?? 0]));
const shape = (next: number[]) => (Array.isArray(model.value) ? next : (next[0] ?? 0));
const onUpdate = (next: number[] | undefined) => {
  if (next) model.value = shape(next);
};

const thumbOwned = ["aria-label", "aria-labelledby", "aria-valuetext", "aria-invalid", "aria-describedby"];
const rootAttrs = computed(() => {
  const rest = Object.fromEntries(Object.entries(attrs).filter(([key]) => !thumbOwned.includes(key)));
  if (values.value.length === 1) return rest;
  return { ...rest, "role": "group", "aria-label": attrs["aria-label"], "aria-labelledby": control.labelledBy.value };
});
const thumbAttrs = computed(() => ({
  "aria-invalid": control.invalid.value,
  "aria-describedby": control.describedBy.value,
  ...(values.value.length === 1 && {
    "aria-label": attrs["aria-label"],
    "aria-labelledby": control.labelledBy.value,
    "aria-valuetext": attrs["aria-valuetext"],
  }),
}));

provideSliderContext({
  variant: computed(() => props.variant),
  touchTarget: computed(() => props.touchTarget),
  thumbAttrs,
});

const onPointerDown = (event: PointerEvent) => {
  const root = event.currentTarget as HTMLElement;
  queueMicrotask(() => {
    const thumb = document.activeElement;
    if (!(thumb instanceof HTMLElement) || !root.contains(thumb) || !thumb.matches(":focus-visible")) return;
    thumb.blur();
    thumb.focus({ focusVisible: false });
  });
};
</script>

<template>
  <SliderRoot
    v-bind="{ ...rootAttrs, ...forwarded }"
    :id="control.id.value"
    data-slot="slider"
    :data-variant="props.variant ?? 'default'"
    :data-color="props.color"
    :data-size="props.size"
    :data-touch-target="props.touchTarget"
    :model-value="values"
    :disabled="control.disabled.value"
    :required="control.required.value"
    :class="
      cn(sliderVariants({ variant: props.variant, size: props.size, touchTarget: props.touchTarget }), props.class)
    "
    @pointerdown="onPointerDown"
    @update:model-value="onUpdate"
    @value-commit="emits('valueCommit', shape($event))"
  >
    <slot
      :thumbs="values.length"
      :values="values"
    >
      <SliderTrack>
        <SliderRange />
      </SliderTrack>
      <SliderThumb
        v-for="(_, index) in values"
        :key="index"
      />
    </slot>
  </SliderRoot>
</template>
