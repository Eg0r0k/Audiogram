import { type VariantProps, cva } from "class-variance-authority";

export { default as Kbd } from "./Kbd.vue";
export { default as KbdGroup } from "./KbdGroup.vue";

export const kbdVariants = cva(
  `
    pointer-events-none inline-flex w-fit items-center justify-center bg-muted font-sans text-muted-foreground
    select-none
    in-[button]:bg-current/15 in-[button]:text-current
    in-data-[slot=tooltip-content]:bg-current/20 in-data-[slot=tooltip-content]:text-current
  `,
  {
    variants: {
      size: {
        xs: "h-4 min-w-4 gap-0.5 rounded-control-3xs px-0.5 text-label-sm icon-size-2.5",
        sm: "h-4.5 min-w-4.5 gap-0.5 rounded-control-2xs px-1 text-label-sm icon-size-3",
        md: "h-5 min-w-5 gap-1 rounded-control-2xs px-1 text-label-md icon-size-3",
        lg: "h-6 min-w-6 gap-1 rounded-control-xs px-1.5 text-label-md icon-size-3.5",
        xl: "h-7 min-w-7 gap-1.5 rounded-control-xs px-2 text-label-lg icon-size-4",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export type KbdVariants = VariantProps<typeof kbdVariants>;
export type KbdSize = NonNullable<KbdVariants["size"]>;
