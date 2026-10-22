import { type VariantProps, cva } from "class-variance-authority";
import { createContext } from "reka-ui";
import type { ComputedRef } from "vue";

import { textControlFrameVariant, textControlRadius, textControlText } from "@/lib/text-control";

export { default as InputGroup } from "./InputGroup.vue";
export { default as InputGroupAddon } from "./InputGroupAddon.vue";
export { default as InputGroupButton } from "./InputGroupButton.vue";
export { default as InputGroupInput } from "./InputGroupInput.vue";
export { default as InputGroupText } from "./InputGroupText.vue";
export { default as InputGroupTextarea } from "./InputGroupTextarea.vue";

export const inputGroupVariants = cva(
  `
    group/input-group relative flex w-full min-w-0 items-center
    transition-[color,background-color,border-color,box-shadow] duration-short-3 ease-standard
    has-[>textarea]:h-auto
    has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col
    has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col
    [--input-group-addon-opacity:1]
    has-[:is(input,textarea):not([data-slot=input-group-addon]_*):disabled]:[--input-group-addon-opacity:var(--disabled-opacity)]
  `,
  {
    variants: {
      variant: textControlFrameVariant,
      size: {
        xs: `h-(--control-height-xs) ${textControlRadius.xs}
          [--input-group-height:var(--control-height-xs)] [--input-group-padding:var(--control-padding-xs)]
          [--input-group-icon:var(--control-icon-xs)]
          ${textControlText.xs}
        `,
        sm: `h-(--control-height-sm) ${textControlRadius.sm}
          [--input-group-height:var(--control-height-sm)] [--input-group-padding:var(--control-padding-sm)]
          [--input-group-icon:var(--control-icon-sm)]
          ${textControlText.sm}
        `,
        md: `h-(--control-height-md) ${textControlRadius.md}
          [--input-group-height:var(--control-height-md)] [--input-group-padding:var(--control-padding-md)]
          [--input-group-icon:var(--control-icon-md)]
          ${textControlText.md}
        `,
        lg: `h-(--control-height-lg) ${textControlRadius.lg}
          [--input-group-height:var(--control-height-lg)] [--input-group-padding:var(--control-padding-lg)]
          [--input-group-icon:var(--control-icon-lg)]
          ${textControlText.lg}
        `,
        xl: `h-(--control-height-xl) ${textControlRadius.xl}
          [--input-group-height:var(--control-height-xl)] [--input-group-padding:var(--control-padding-xl)]
          [--input-group-icon:var(--control-icon-xl)]
          ${textControlText.xl}
        `,
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "md",
    },
  },
);

// Every control of a group takes this. The addons are its siblings in either
// order, so the inset reads them with ~ and a :has() on the control itself.
export const inputGroupControlInset = `
  has-[~[data-align=inline-start]]:ps-2 [[data-align=inline-start]~&]:ps-2
  has-[~[data-align=inline-end]]:pe-2 [[data-align=inline-end]~&]:pe-2
`;

export const inputGroupAddonVariants = cva(
  `
    flex cursor-text items-center gap-2 text-body-md text-muted-foreground select-none
    [&>svg]:pointer-events-none
    [&>svg:not([class*='size-'])]:size-(--input-group-icon)
    opacity-(--input-group-addon-opacity)
  `,
  {
    variants: {
      align: {
        "inline-start": "order-first ps-(--input-group-padding)",
        "inline-end": "order-last pe-(--input-group-padding)",
        "block-start": `
          order-first w-full justify-start p-2
          *:[--input-group-button-inset:calc(var(--spacing)*2+1px)]
          *:data-[slot=input-group-text]:px-1
        `,
        "block-end": `
          order-last w-full justify-start p-2
          *:[--input-group-button-inset:calc(var(--spacing)*2+1px)]
          *:data-[slot=input-group-text]:px-1
        `,
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  },
);

export const inputGroupButtonVariants = cva(
  `
    rounded-inset-(--frame-radius)/(--input-group-button-inset) shadow-none
    in-[[data-slot=input-group].rounded-full]:rounded-full
    [--input-group-button-inset:calc((var(--input-group-height)-var(--input-group-button-height))/2)]
    in-data-[align=inline-start]:first:-ms-[calc(var(--input-group-padding)-var(--input-group-button-inset)+1px)]
    in-data-[align=inline-end]:last:-me-[calc(var(--input-group-padding)-var(--input-group-button-inset)+1px)]
  `,
  {
    variants: {
      size: {
        "xs": "h-6 gap-1 px-2 text-label-sm [--input-group-button-height:--spacing(6)] icon-size-3.5",
        "sm": "h-8 gap-1.5 px-2.5 text-label-md [--input-group-button-height:--spacing(8)]",
        "icon-xs": "size-6 p-0 [--input-group-button-height:--spacing(6)] icon-size-3.5",
        "icon-sm": "size-8 p-0 [--input-group-button-height:--spacing(8)]",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  },
);

export type InputGroupVariants = VariantProps<typeof inputGroupVariants>;
export type InputGroupAddonVariants = VariantProps<typeof inputGroupAddonVariants>;
export type InputGroupButtonVariants = VariantProps<typeof inputGroupButtonVariants>;

export type InputGroupVariant = NonNullable<InputGroupVariants["variant"]>;
export type InputGroupSize = NonNullable<InputGroupVariants["size"]>;

export const [injectInputGroupContext, provideInputGroupContext] = createContext<{
  variant: ComputedRef<InputGroupVariant>;
  size: ComputedRef<InputGroupSize>;
}>("InputGroup");
