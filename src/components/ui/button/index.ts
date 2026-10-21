import { type VariantProps, cva } from "class-variance-authority";

export { default as Button } from "./Button.vue";

export type ButtonColor = "primary" | "neutral" | "destructive" | "success" | "warning" | "info";

export const swallowWhenDisabled = (event: MouseEvent) => {
  if ((event.currentTarget as HTMLElement).getAttribute("aria-disabled") !== "true") return;
  event.preventDefault();
  event.stopImmediatePropagation();
};

export const buttonVariants = cva(
  `
    relative cursor-pointer inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-control-md
    text-label-lg transition duration-short-3 ease-standard outline-none
    forced-colors:border
    disabled:pointer-events-none disabled:text-foreground/(--disabled-opacity)
    [&_svg]:pointer-events-none [&_svg]:shrink-0
    aria-disabled:cursor-default aria-disabled:text-foreground/(--disabled-opacity)
  `,
  {
    variants: {
      variant: {
        solid: `
          state-layer bg-tone text-tone-foreground
          disabled:bg-foreground/(--disabled-container-opacity)
          aria-disabled:bg-foreground/(--disabled-container-opacity)
        `,
        soft: `
          state-layer bg-tone-soft text-tone-soft-foreground
          disabled:bg-foreground/(--disabled-container-opacity)
          aria-disabled:bg-foreground/(--disabled-container-opacity)
        `,
        subtle: `
          state-layer bg-tone-soft text-tone-soft-foreground inset-ring inset-ring-tone-border-subtle
          disabled:bg-foreground/(--disabled-container-opacity)
          disabled:inset-ring-foreground/(--disabled-container-opacity)
          aria-disabled:bg-foreground/(--disabled-container-opacity)
          aria-disabled:inset-ring-foreground/(--disabled-container-opacity)
        `,
        outline: `
          state-layer text-tone-text inset-ring inset-ring-tone-border
          disabled:inset-ring-foreground/(--disabled-container-opacity)
          aria-disabled:inset-ring-foreground/(--disabled-container-opacity)
        `,
        ghost: "state-layer text-tone-text",
        link: "text-tone-text underline-offset-4 hover:underline aria-disabled:hover:no-underline",
      },
      size: {
        "xs": `
          h-(--control-height-xs) gap-(--control-gap-xs) rounded-control-xs px-2.5 text-label-sm
          [--touch-h:var(--control-height-xs)]
          has-data-[icon=inline-start]:ps-2
          has-data-[icon=inline-end]:pe-2
          icon-size-(--control-icon-xs)
        `,
        "sm": `
          h-(--control-height-sm) gap-1.5 px-3 text-label-lg [--touch-h:var(--control-height-sm)] has-[>svg]:px-2.5
          has-data-[icon=inline-start]:ps-2.5
          has-data-[icon=inline-end]:pe-2.5
          icon-size-(--control-icon-sm)
        `,
        "md": `
          h-(--control-height-md) gap-(--control-gap-md) px-4 py-2 [--touch-h:var(--control-height-md)] has-[>svg]:px-3
          has-data-[icon=inline-start]:ps-3
          has-data-[icon=inline-end]:pe-3
          icon-size-(--control-icon-md)
        `,
        "lg": `
          h-(--control-height-lg) gap-(--control-gap-lg) px-6 [--touch-h:var(--control-height-lg)] has-[>svg]:px-4
          has-data-[icon=inline-start]:ps-4
          has-data-[icon=inline-end]:pe-4
          icon-size-(--control-icon-lg)
        `,
        "xl": `
          h-(--control-height-xl) gap-8 rounded-control-md px-6 text-title-md has-[>svg]:px-4
          [--touch-h:var(--control-height-xl)]
          has-data-[icon=inline-start]:ps-6
          has-data-[icon=inline-end]:pe-6
          icon-size-(--control-icon-xl)
        `,
        "icon-xs": `
          size-(--control-height-xs) rounded-control-xs [--touch-w:var(--control-height-xs)]
          [--touch-h:var(--control-height-xs)] icon-size-(--control-icon-xs)
        `,
        "icon-sm": `
          size-(--control-height-sm) [--touch-w:var(--control-height-sm)] [--touch-h:var(--control-height-sm)]
          icon-size-(--control-icon-sm)
        `,
        "icon-md": `
          size-(--control-height-md) [--touch-w:var(--control-height-md)] [--touch-h:var(--control-height-md)]
          icon-size-(--control-icon-md)
        `,
        "icon-lg": `
          size-(--control-height-lg) [--touch-w:var(--control-height-lg)] [--touch-h:var(--control-height-lg)]
          icon-size-(--control-icon-lg)
        `,
        "icon-xl": `
          size-(--control-height-xl) rounded-control-xl [--touch-w:var(--control-height-xl)]
          [--touch-h:var(--control-height-xl)] icon-size-(--control-icon-xl)
        `,
      },
      focusRing: {
        outward: "focus-visible:focus-ring",
        inward: "focus-visible:focus-ring-inset",
      },
      touchTarget: {
        none: "",
        expand: "touch-target",
        wrapper: "touch-target-wrapper",
      },
    },
    defaultVariants: {
      variant: "solid",
      size: "md",
      touchTarget: "none",
      focusRing: "outward",
    },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
export type ButtonSize = NonNullable<ButtonVariants["size"]>;
