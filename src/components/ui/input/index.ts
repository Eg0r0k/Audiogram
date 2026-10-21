import { type VariantProps, cva } from "class-variance-authority";

import { textControlBase, textControlRadius, textControlSize, textControlVariant } from "@/lib/text-control";

export { default as Input } from "./Input.vue";

export const inputVariants = cva(
  `${textControlBase} file:me-3 file:inline-flex file:h-full file:border-0 file:bg-transparent file:text-label-lg file:text-foreground`,
  {
    variants: {
      variant: textControlVariant,
      size: {
        xs: `h-(--control-height-xs) ${textControlSize.xs} ${textControlRadius.xs}`,
        sm: `h-(--control-height-sm) ${textControlSize.sm} ${textControlRadius.sm}`,
        md: `h-(--control-height-md) ${textControlSize.md} ${textControlRadius.md}`,
        lg: `h-(--control-height-lg) ${textControlSize.lg} ${textControlRadius.lg}`,
        xl: `h-(--control-height-xl) ${textControlSize.xl} ${textControlRadius.xl}`,
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "md",
    },
  },
);

export type InputVariants = VariantProps<typeof inputVariants>;
