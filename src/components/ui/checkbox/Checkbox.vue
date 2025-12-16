<script setup lang="ts">
import type { CheckboxRootEmits, CheckboxRootProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { cva, type VariantProps } from "class-variance-authority";
import { Check } from "lucide-vue-next";
import { CheckboxIndicator, CheckboxRoot, useForwardPropsEmits } from "reka-ui";
import { cn } from "@/lib/utils";

const checkboxVariants = cva(
  "checkbox-animated peer relative cursor-pointer overflow-hidden border-input data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive shrink-0 border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      size: {
        sm: "size-3.5 rounded-[3px] [&_svg]:!size-2.5",
        default: "size-4 rounded-[4px] [&_svg]:!size-3",
        lg: "size-5 rounded-[5px] [&_svg]:!size-3.5",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

type CheckboxVariants = VariantProps<typeof checkboxVariants>;

const props = defineProps<
  CheckboxRootProps & {
    class?: HTMLAttributes["class"];
    size?: CheckboxVariants["size"];
  }
>();
const emits = defineEmits<CheckboxRootEmits>();

const delegatedProps = reactiveOmit(props, "class", "size");
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <CheckboxRoot
    v-slot="slotProps"
    data-slot="checkbox"
    v-bind="forwarded"
    :class="cn(checkboxVariants({ size }), props.class)"
  >
    <span class="checkbox-bg" />

    <CheckboxIndicator
      data-slot="checkbox-indicator"
      class="checkbox-icon relative z-10 grid place-content-center text-current"
    >
      <slot v-bind="slotProps">
        <Check />
      </slot>
    </CheckboxIndicator>
  </CheckboxRoot>
</template>

<style>
.checkbox-bg {
  position: absolute;
  inset: -15%;
  background-color: var(--primary);
  border-radius: 50%;
  transform: scale(0);
  transition: transform 0.2s 0.05s ease-in-out;
  pointer-events: none;
}

.checkbox-icon {
  opacity: 0;
  transition: opacity 0.1s 0s ease-in-out;
}

@supports (-webkit-touch-callout: none) {
  .checkbox-animated {
    -webkit-mask-image: -webkit-radial-gradient(circle, white 100%, black 100%);
  }
}

.checkbox-animated[data-state="checked"] .checkbox-bg,
.checkbox-animated[data-state="indeterminate"] .checkbox-bg {
  transform: scale(1);
  transition: transform 0.2s 0s ease-in-out;
}

.checkbox-animated[data-state="checked"] .checkbox-icon,
.checkbox-animated[data-state="indeterminate"] .checkbox-icon {
  opacity: 1;
  transition: opacity 0.1s 0.15s ease-in-out;
}
</style>
