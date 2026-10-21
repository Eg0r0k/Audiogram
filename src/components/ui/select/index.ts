import { type VariantProps, cva } from "class-variance-authority";
import { createContext } from "reka-ui";
import type { Ref } from "vue";

import { textControlBase, textControlRadius, textControlSize, textControlVariant } from "@/lib/text-control";

export { default as Select } from "./Select.vue";
export { default as SelectContent } from "./SelectContent.vue";
export { default as SelectGroup } from "./SelectGroup.vue";
export { default as SelectItem } from "./SelectItem.vue";
export { default as SelectItemText } from "./SelectItemText.vue";
export { default as SelectLabel } from "./SelectLabel.vue";
export { default as SelectScrollDownButton } from "./SelectScrollDownButton.vue";
export { default as SelectScrollUpButton } from "./SelectScrollUpButton.vue";
export { default as SelectSeparator } from "./SelectSeparator.vue";
export { default as SelectTrigger } from "./SelectTrigger.vue";
export { default as SelectValue } from "./SelectValue.vue";

export const selectTriggerVariants = cva(
  `${textControlBase}
    group/select-trigger flex cursor-default items-center justify-between text-start whitespace-nowrap
    data-placeholder:text-muted-foreground
    *:data-[slot=select-value]:truncate
    [&_svg]:pointer-events-none [&_svg]:shrink-0
  `,
  {
    variants: {
      variant: textControlVariant,
      size: {
        xs: `h-(--control-height-xs) gap-(--control-gap-xs) icon-size-(--control-icon-xs) ${textControlSize.xs} ${textControlRadius.xs}`,
        sm: `h-(--control-height-sm) gap-(--control-gap-sm) icon-size-(--control-icon-sm) ${textControlSize.sm} ${textControlRadius.sm}`,
        md: `h-(--control-height-md) gap-(--control-gap-md) icon-size-(--control-icon-md) ${textControlSize.md} ${textControlRadius.md}`,
        lg: `h-(--control-height-lg) gap-(--control-gap-lg) icon-size-(--control-icon-lg) ${textControlSize.lg} ${textControlRadius.lg}`,
        xl: `h-(--control-height-xl) gap-(--control-gap-xl) icon-size-(--control-icon-xl) ${textControlSize.xl} ${textControlRadius.xl}`,
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "md",
    },
  },
);

export type SelectTriggerVariants = VariantProps<typeof selectTriggerVariants>;
export type SelectSize = NonNullable<SelectTriggerVariants["size"]>;

export const [injectSelectSize, provideSelectSize] = createContext<Ref<SelectSize | undefined>>("Select");
