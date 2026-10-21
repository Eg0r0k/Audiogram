<script setup lang="ts">
import {
  CheckboxIndicator,
  CheckboxRoot,
  type CheckboxRootEmits,
  type CheckboxRootProps,
  useForwardPropsEmits,
} from "reka-ui";
import { type HTMLAttributes, computed, ref, useAttrs } from "vue";

import { useFieldControl } from "@/lib/field-context";
import { cn } from "@/lib/utils";
import {
  type CheckboxColor,
  type CheckboxSize,
  type CheckboxVariants,
  checkboxVariants,
  injectCheckboxGroupContext,
} from ".";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<
    Omit<CheckboxRootProps, "as" | "asChild"> & {
      /** Defaults to the group's `color`, or `primary` outside a group. */
      color?: CheckboxColor | (string & {});
      size?: CheckboxSize;
      touchTarget?: CheckboxVariants["touchTarget"];
      class?: HTMLAttributes["class"];
    }
  >(),
  { size: "md" },
);
const emits = defineEmits<CheckboxRootEmits>();

const delegated = computed(() => {
  const { class: _, size: __, touchTarget: ___, color: ____, ...rest } = props;
  return rest;
});
const forwarded = useForwardPropsEmits(delegated, emits);

const attrs = useAttrs();
const control = useFieldControl(props, attrs);

const group = injectCheckboxGroupContext(null);
const color = computed(() => props.color ?? group?.color.value ?? "primary");

const hovered = ref(false);
const onPointerEnter = (event: PointerEvent) => {
  if (event.pointerType === "mouse") hovered.value = true;
};
const onPointerLeave = () => {
  hovered.value = false;
};
</script>

<template>
  <CheckboxRoot
    v-bind="{ ...attrs, ...forwarded }"
    :id="control.id.value"
    data-slot="checkbox"
    :data-color="color"
    :data-size="props.size"
    :data-touch-target="props.touchTarget"
    :data-hovered="hovered || undefined"
    :disabled="control.disabled.value"
    :required="control.required.value"
    :aria-invalid="control.invalid.value"
    :aria-describedby="control.describedBy.value"
    :class="cn(checkboxVariants({ size: props.size, touchTarget: props.touchTarget }), props.class)"
    @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeave"
  >
    <CheckboxIndicator
      force-mount
      class="pointer-events-none absolute -inset-0.5"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        class="size-full"
      >
        <path
          d="M6 12.5l4 4 8-9"
          pathLength="1"
          class="[stroke-dasharray:1] [stroke-dashoffset:1] transition-[stroke-dashoffset] duration-short-4 ease-standard group-data-[state=checked]/checkbox:[stroke-dashoffset:0] motion-reduce:transition-none"
        />
        <path
          d="M7 12h10"
          pathLength="1"
          class="[stroke-dasharray:1] [stroke-dashoffset:1] transition-[stroke-dashoffset] duration-short-4 ease-standard group-data-[state=indeterminate]/checkbox:[stroke-dashoffset:0] motion-reduce:transition-none"
        />
      </svg>
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
