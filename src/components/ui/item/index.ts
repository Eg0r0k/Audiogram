import { type VariantProps, cva } from "class-variance-authority";
import { createContext } from "reka-ui";
import type { ComputedRef } from "vue";

export { default as Item } from "./Item.vue";
export { default as ItemActions } from "./ItemActions.vue";
export { default as ItemContent } from "./ItemContent.vue";
export { default as ItemDescription } from "./ItemDescription.vue";
export { default as ItemFooter } from "./ItemFooter.vue";
export { default as ItemGroup } from "./ItemGroup.vue";
export { default as ItemHeader } from "./ItemHeader.vue";
export { default as ItemMedia } from "./ItemMedia.vue";
export { default as ItemSeparator } from "./ItemSeparator.vue";
export { default as ItemTitle } from "./ItemTitle.vue";

export const [injectItemGroupContext, provideItemGroupContext] = createContext<{ list: ComputedRef<boolean> }>(
  "ItemGroup",
);

export const itemVariants = cva(
  `
    group/item relative flex flex-wrap items-center border border-transparent text-sm outline-none transition-colors
    duration-short-4 ease-standard [--item-radius:calc(var(--radius)-2px)]
    focus-visible:focus-ring
    [a&]:cursor-pointer [a&]:state-layer
    [button&]:cursor-pointer [button&]:state-layer [button&]:text-start
    data-pressable:cursor-pointer data-pressable:state-layer data-pressable:select-none
  `,
  {
    variants: {
      variant: {
        outline: "border-border",
        soft: "bg-muted",
        filled: "border-b-border bg-muted",
        ghost: "",
        subtle: "border-border bg-muted",
      },
      size: {
        xs: "gap-2 rounded-item-xs px-3 py-2 [--item-media:--spacing(6)]",
        sm: "gap-2.5 rounded-item-sm px-4 py-3 [--item-media:--spacing(7)]",
        md: "gap-4 rounded-item-md p-4 [--item-media:--spacing(8)]",
        lg: "gap-4 rounded-item-lg p-5 [--item-media:--spacing(9)]",
        xl: "gap-5 rounded-item-xl p-6 [--item-media:--spacing(10)]",
      },
    },
    compoundVariants: [{ variant: "filled", class: "rounded-b-none" }],
    defaultVariants: {
      variant: "ghost",
      size: "md",
    },
  },
);

export const itemMediaVariants = cva(
  `
    flex shrink-0 items-center justify-center gap-2 translate-y-[var(--item-media-shift,0)]
    [align-self:var(--item-media-align,auto)]
    [&_svg]:pointer-events-none
  `,
  {
    variants: {
      variant: {
        default: "text-muted-foreground",
        icon: "size-(--item-media) rounded-control-xs border border-border bg-muted icon-size-[calc(var(--item-media)/2)]",
        image: `
          size-[calc(var(--item-media)+--spacing(2))] overflow-hidden rounded-control-xs
          [&_img]:size-full [&_img]:object-cover
        `,
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type ItemVariants = VariantProps<typeof itemVariants>;
export type ItemSize = NonNullable<ItemVariants["size"]>;
export type ItemMediaVariants = VariantProps<typeof itemMediaVariants>;
