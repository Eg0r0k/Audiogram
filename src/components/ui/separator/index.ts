import { type VariantProps, cva } from "class-variance-authority";

export { default as Separator } from "./Separator.vue";

export const separatorVariants = cva("group/separator shrink-0", {
  variants: {
    size: {
      xs: "[--separator-size:1px]",
      sm: "[--separator-size:2px]",
      md: "[--separator-size:3px]",
      lg: "[--separator-size:4px]",
      xl: "[--separator-size:5px]",
    },
  },
  defaultVariants: {
    size: "xs",
  },
});

export type SeparatorVariants = VariantProps<typeof separatorVariants>;
export type SeparatorSize = NonNullable<SeparatorVariants["size"]>;
