import { type VariantProps, cva } from "class-variance-authority";

import { textControlBase, textControlRadius, textControlSize, textControlVariant } from "@/lib/text-control";

export { default as Textarea } from "./Textarea.vue";

export const textareaVariants = cva(`${textControlBase} block resize-y py-[calc((var(--control-height)-1lh)/2-1px)]`, {
  variants: {
    variant: textControlVariant,
    size: {
      xs: `[--control-height:var(--control-height-xs)] ${textControlSize.xs} ${textControlRadius.xs}`,
      sm: `[--control-height:var(--control-height-sm)] ${textControlSize.sm} ${textControlRadius.sm}`,
      md: `[--control-height:var(--control-height-md)] ${textControlSize.md} ${textControlRadius.md}`,
      lg: `[--control-height:var(--control-height-lg)] ${textControlSize.lg} ${textControlRadius.lg}`,
      xl: `[--control-height:var(--control-height-xl)] ${textControlSize.xl} ${textControlRadius.xl}`,
    },
  },
  compoundVariants: [{ variant: "filled", class: "pt-[calc((var(--control-height)-1lh)/2)]" }],
  defaultVariants: {
    variant: "outline",
    size: "md",
  },
});

export type TextareaVariants = VariantProps<typeof textareaVariants>;
export type TextareaSize = NonNullable<TextareaVariants["size"]>;
