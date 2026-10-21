<script setup lang="ts">
import { SwitchRoot, type SwitchRootEmits, type SwitchRootProps, SwitchThumb, useForwardPropsEmits } from "reka-ui";
import { type HTMLAttributes, computed, ref, useAttrs, useSlots } from "vue";

import { useFieldControl } from "@/lib/field-context";
import { cn } from "@/lib/utils";
import {
  type SwitchColor,
  type SwitchSize,
  type SwitchVariants,
  switchHandleClass,
  switchIconClass,
  switchThumbClass,
  switchVariants,
} from ".";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<
    Omit<SwitchRootProps, "as" | "asChild"> & {
      color?: SwitchColor | (string & {});
      size?: SwitchSize;
      touchTarget?: SwitchVariants["touchTarget"];
      class?: HTMLAttributes["class"];
    }
  >(),
  { color: "primary", size: "md" },
);
const emits = defineEmits<SwitchRootEmits>();
const slots = useSlots();

const delegated = computed(() => {
  const { class: _, size: __, touchTarget: ___, color: ____, ...rest } = props;
  return rest;
});
const forwarded = useForwardPropsEmits(delegated, emits);

const attrs = useAttrs();
const control = useFieldControl(props, attrs);

const hovered = ref(false);
const onPointerEnter = (event: PointerEvent) => {
  if (event.pointerType === "mouse") hovered.value = true;
};
const onPointerLeave = () => {
  hovered.value = false;
};
</script>

<template>
  <SwitchRoot
    v-bind="{ ...attrs, ...forwarded }"
    :id="control.id.value"
    data-slot="switch"
    :data-color="props.color"
    :data-size="props.size"
    :data-touch-target="props.touchTarget"
    :data-unchecked-icon="slots['unchecked-icon'] ? '' : undefined"
    :disabled="control.disabled.value"
    :required="control.required.value"
    :aria-invalid="control.invalid.value"
    :aria-describedby="control.describedBy.value"
    :class="cn(switchVariants({ size: props.size, touchTarget: props.touchTarget }), props.class)"
    @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeave"
  >
    <SwitchThumb
      data-slot="switch-thumb"
      :data-hovered="hovered || undefined"
      :class="switchThumbClass"
    >
      <span
        data-slot="switch-handle"
        :class="switchHandleClass"
      >
        <span
          v-if="slots['checked-icon']"
          aria-hidden="true"
          :class="
            cn(
              switchIconClass,
              `
                text-tone opacity-0
                group-data-[state=checked]/switch:opacity-100
                group-disabled/switch:text-foreground/(--disabled-opacity)
              `,
              !slots['unchecked-icon'] && '-rotate-45 group-data-[state=checked]/switch:rotate-0',
            )
          "
        >
          <slot name="checked-icon" />
        </span>
        <span
          v-if="slots['unchecked-icon']"
          aria-hidden="true"
          :class="
            cn(
              switchIconClass,
              'text-muted group-data-[state=checked]/switch:opacity-0 group-disabled/switch:text-background',
            )
          "
        >
          <slot name="unchecked-icon" />
        </span>
      </span>
    </SwitchThumb>
  </SwitchRoot>
</template>
