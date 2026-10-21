import { type VariantProps, cva } from "class-variance-authority";

export { default as Switch } from "./Switch.vue";

export type SwitchColor = "primary" | "neutral" | "destructive" | "success" | "warning" | "info";

export const switchVariants = cva(
  `
    group/switch relative inline-flex h-(--switch-h) w-(--switch-w) shrink-0 items-center rounded-full
    bg-input outline-none transition-[background-color] duration-short-1 ease-linear dark:data-[state=unchecked]:bg-input/80
    [--switch-w:calc(var(--switch-h)*2)] [--touch-w:var(--switch-w)] [--touch-h:var(--switch-h)]
    [--halo-size:calc(var(--switch-h)*1.25)] tone-control [--halo-color:--theme(--color-foreground)]
    aria-invalid:tone-invalid
    data-[state=checked]:[--halo-color:var(--tone)]
    focus-visible:focus-ring
    data-[state=checked]:bg-tone
    disabled:cursor-not-allowed disabled:opacity-50
  `,
  {
    variants: {
      size: {
        xs: "[--switch-h:1rem]",
        sm: "[--switch-h:1.25rem]",
        md: "[--switch-h:1rem]",
        lg: "[--switch-h:1.75rem]",
        xl: "[--switch-h:2rem]",
      },
      touchTarget: {
        none: "",
        expand: "touch-target",
        wrapper: "touch-target-wrapper",
      },
    },
    defaultVariants: {
      size: "md",
      touchTarget: "none",
    },
  },
);

export const switchThumbClass = `
  pointer-events-none absolute start-0 top-0 flex size-(--switch-h) items-center justify-center
  state-halo transition-[translate] duration-medium-2 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]
  group-disabled/switch:transition-none
  motion-reduce:transition-none
  data-[state=checked]:translate-x-[calc(var(--switch-w)-var(--switch-h))]
  rtl:data-[state=checked]:-translate-x-[calc(var(--switch-w)-var(--switch-h))]
`;

export const switchHandleClass = `
  relative flex size-full items-center justify-center rounded-full bg-background
  shadow-[0_0_0_2px_var(--color-input)] transition-shadow duration-medium-1 ease-standard
  group-data-[state=checked]/switch:shadow-[0_0_0_2px_var(--tone)]
  motion-reduce:transition-none
`;

export const switchIconClass = `
  absolute inset-0 flex items-center justify-center transition-[opacity,rotate] duration-short-4 ease-standard
  motion-reduce:transition-none
  [&_svg]:size-[calc(var(--switch-h)/2)] [&_svg]:shrink-0
`;

export type SwitchVariants = VariantProps<typeof switchVariants>;
export type SwitchSize = NonNullable<SwitchVariants["size"]>;
