import { type VariantProps, cva } from "class-variance-authority";
import { createContext } from "reka-ui";
import type { ComputedRef } from "vue";

import {
  type TextControlVariant,
  textControlBase,
  textControlFrameVariant,
  textControlInnerText,
  textControlRadius,
  textControlText,
} from "@/lib/text-control";

export { default as InputNumber } from "./InputNumber.vue";
export { default as InputNumberDecrement } from "./InputNumberDecrement.vue";
export { default as InputNumberIncrement } from "./InputNumberIncrement.vue";
export { default as InputNumberInput } from "./InputNumberInput.vue";

export type InputNumberOrientation = "horizontal" | "vertical";

export type InputNumberContext = {
  variant: TextControlVariant;
  orientation: InputNumberOrientation;
  invalid: boolean | "true" | "false" | undefined;
  required: boolean | undefined;
  describedBy: string | undefined;
};

export const [injectInputNumberContext, provideInputNumberContext]
  = createContext<ComputedRef<InputNumberContext>>("InputNumber");

export const inputNumberVariants = cva(
  `
    grid w-full min-w-0 items-center transition-[color,background-color,border-color,box-shadow] duration-short-3
    ease-standard
  `,
  {
    variants: {
      variant: textControlFrameVariant,
      size: {
        xs: `h-(--control-height-xs) ${textControlRadius.xs} ${textControlText.xs}
          [--control-padding:var(--control-padding-xs)] [--stepper-size:--spacing(6)] [--stepper-inset:--spacing(0.5)]
          [--stepper-icon:--spacing(3.5)] [--stepper-chevron:--spacing(3)]
        `,
        sm: `h-(--control-height-sm) ${textControlRadius.sm} ${textControlText.sm}
          [--control-padding:var(--control-padding-sm)] [--stepper-size:--spacing(6)] [--stepper-inset:--spacing(1)]
          [--stepper-icon:--spacing(3.5)] [--stepper-chevron:--spacing(3)]
        `,
        md: `h-(--control-height-md) ${textControlRadius.md} ${textControlText.md}
          [--control-padding:var(--control-padding-md)] [--stepper-size:--spacing(7)] [--stepper-inset:--spacing(1)]
          [--stepper-icon:--spacing(4)] [--stepper-chevron:--spacing(3.5)]
        `,
        lg: `h-(--control-height-lg) ${textControlRadius.lg} ${textControlText.lg}
          [--control-padding:var(--control-padding-lg)] [--stepper-size:--spacing(8)] [--stepper-inset:--spacing(1)]
          [--stepper-icon:--spacing(4)] [--stepper-chevron:--spacing(3.5)]
        `,
        xl: `h-(--control-height-xl) ${textControlRadius.xl} ${textControlText.xl}
          [--control-padding:var(--control-padding-xl)] [--stepper-size:--spacing(10)] [--stepper-inset:--spacing(1)]
          [--stepper-icon:--spacing(5)] [--stepper-chevron:--spacing(4)]
        `,
      },
      orientation: {
        horizontal: `
          grid-cols-[auto_minmax(0,1fr)_auto] [grid-template-areas:'decrement_input_increment']
          [--input-number-align:center]
        `,
        vertical: `
          grid-cols-[minmax(0,1fr)_auto] grid-rows-2 [grid-template-areas:'input_increment'_'input_decrement']
          [--input-number-align:start]
        `,
      },
    },
    defaultVariants: { variant: "outline", size: "md", orientation: "horizontal" },
  },
);

// The input tightens its padding on a side with a button. The buttons are its
// siblings, so it reads them with ~ and a :has() on itself.
export const inputNumberInputInset: Record<InputNumberOrientation, string> = {
  horizontal: `
    has-[~[data-slot=input-number-decrement]]:ps-1.5 [[data-slot=input-number-decrement]~&]:ps-1.5
    has-[~[data-slot=input-number-increment]]:pe-1.5 [[data-slot=input-number-increment]~&]:pe-1.5
  `,
  vertical: `
    has-[~:is([data-slot=input-number-increment],[data-slot=input-number-decrement])]:pe-1.5
    [:is([data-slot=input-number-increment],[data-slot=input-number-decrement])~&]:pe-1.5
  `,
};

export const inputNumberInput = `${textControlBase} ${textControlInnerText} h-full rounded-none px-(--control-padding) [grid-area:input] [text-align:var(--input-number-align,start)]`;

export const inputNumberButtonVariants = cva("p-0", {
  variants: {
    orientation: {
      horizontal: `size-(--stepper-size) rounded-inset-(--frame-radius)/(--stepper-inset) icon-size-(--stepper-icon)`,
      vertical: "h-full w-(--stepper-size) rounded-none icon-size-(--stepper-chevron)",
    },
    part: {
      increment: "[grid-area:increment]",
      decrement: "[grid-area:decrement]",
    },
  },
  compoundVariants: [
    { orientation: "horizontal", part: "increment", class: "me-[calc(var(--stepper-inset)-1px)]" },
    { orientation: "horizontal", part: "decrement", class: "ms-[calc(var(--stepper-inset)-1px)]" },
    { orientation: "vertical", part: "increment", class: "rounded-se-[calc(var(--frame-radius)-1px)]" },
    { orientation: "vertical", part: "decrement", class: "rounded-ee-[calc(var(--frame-radius)-1px)]" },
  ],
  defaultVariants: { orientation: "horizontal" },
});

export type InputNumberVariants = VariantProps<typeof inputNumberVariants>;
