import { type VariantProps, cva } from "class-variance-authority";

export { default as Badge } from "./Badge.vue";

export type BadgeColor = "primary" | "neutral" | "destructive" | "success" | "warning" | "info";

export const badgeVariants = cva(
  `
    relative inline-flex w-fit shrink-0 items-center justify-center whitespace-nowrap outline-none transition-colors
    duration-short-3 ease-standard
    focus-visible:focus-ring
    [&_svg]:pointer-events-none [&_svg]:shrink-0
  `,
  {
    variants: {
      variant: {
        solid: "bg-tone text-tone-foreground",
        soft: "bg-tone-soft text-tone-soft-foreground",
        subtle: "border border-tone-border-subtle bg-tone-soft text-tone-soft-foreground",
        outline: "border border-tone-border text-tone-text",
        ghost: "text-tone-text",
        link: "text-tone-text underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-4 gap-0.5 rounded-full text-label-sm [--touch-h:1rem] icon-size-3",
        sm: "h-5 gap-1 rounded-full text-label-sm [--touch-h:1.25rem] icon-size-3",
        md: "h-6 gap-1 rounded-full text-label-md [--touch-h:1.5rem] icon-size-3.5",
        lg: "h-7 gap-1.5 rounded-full text-label-lg [--touch-h:1.75rem] icon-size-4",
        xl: "h-8 gap-1.5 rounded-full text-label-lg [--touch-h:2rem] icon-size-4",
      },
      square: {
        true: "",
        false: "",
      },
      touchTarget: {
        none: "",
        expand: "touch-target",
        wrapper: "touch-target-wrapper",
      },
    },
    compoundVariants: [
      {
        square: false,
        size: "xs",
        class: "px-1 has-data-[icon=inline-start]:ps-0.5 has-data-[icon=inline-end]:pe-0.5",
      },
      { square: false, size: "sm", class: "px-1.5 has-data-[icon=inline-start]:ps-1 has-data-[icon=inline-end]:pe-1" },
      {
        square: false,
        size: "md",
        class: "px-2 has-data-[icon=inline-start]:ps-1.5 has-data-[icon=inline-end]:pe-1.5",
      },
      { square: false, size: "lg", class: "px-2.5 has-data-[icon=inline-start]:ps-2 has-data-[icon=inline-end]:pe-2" },
      {
        square: false,
        size: "xl",
        class: "px-3 has-data-[icon=inline-start]:ps-2.5 has-data-[icon=inline-end]:pe-2.5",
      },
      { square: true, size: "xs", class: "min-w-4 px-0.5 [--touch-w:1rem]" },
      { square: true, size: "sm", class: "min-w-5 px-0.5 [--touch-w:1.25rem]" },
      { square: true, size: "md", class: "min-w-6 px-1 [--touch-w:1.5rem]" },
      { square: true, size: "lg", class: "min-w-7 px-1 [--touch-w:1.75rem]" },
      { square: true, size: "xl", class: "min-w-8 px-2 [--touch-w:2rem]" },
    ],
    defaultVariants: {
      variant: "solid",
      size: "md",
      square: false,
      touchTarget: "none",
    },
  },
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;
export type BadgeSize = NonNullable<BadgeVariants["size"]>;
