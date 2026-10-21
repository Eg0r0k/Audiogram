import { type VariantProps, cva } from "class-variance-authority";

export { default as ChoiceGroup } from "./ChoiceGroup.vue";

export type ChoiceGroupColor = "primary" | "neutral" | "destructive" | "success" | "warning" | "info";

export const choiceControl = `
  relative inline-flex size-(--choice-size) shrink-0 items-center justify-center border-2 border-tone-border
  outline-none state-halo [--touch-w:var(--choice-size)] [--touch-h:var(--choice-size)]
  [--halo-size:calc(var(--choice-size)*20/9)] tone-control [--halo-color:--theme(--color-foreground)]
  aria-invalid:tone-invalid
  in-aria-invalid:tone-invalid
  data-[state=checked]:[--halo-color:var(--tone)] data-[state=checked]:border-tone-text
  not-data-[touch-target=wrapper]:has-[+[data-slot=field-label],+[data-slot=field-content],+[data-slot=label]]:me-[calc(var(--choice-size)*11/18-0.25rem)]
  focus-visible:focus-ring
  disabled:cursor-not-allowed
`;

export const choiceControlVariants = {
  size: {
    xs: "[--choice-size:0.875rem]",
    sm: "[--choice-size:1rem]",
    md: "[--choice-size:1.125rem]",
    lg: "[--choice-size:1.25rem]",
    xl: "[--choice-size:1.5rem]",
  },
  touchTarget: {
    none: "",
    expand: "touch-target",
    wrapper: "touch-target-wrapper",
  },
};

export const choiceGroupVariants = cva("flex", {
  variants: {
    variant: {
      default: "",
      // Outside primary, a focused card rings like the control in it: in the group's --tone-text, red once invalid.
      card: `
        choice-row gap-3
        [&>[data-slot=field]]:rounded-control-md [&>[data-slot=field]]:border [&>[data-slot=field]]:border-border
        [&>[data-slot=field]]:p-4
        [&>[data-slot=field]:has([data-state=checked])]:border-tone-text
        [&>[data-slot=field]:has(:focus-visible)]:focus-ring
        [&>[data-slot=field][data-invalid]]:border-destructive
        [&:not([data-color=primary])>[data-slot=field]]:[--focus-ring-color:var(--tone-text)]
        [&:not([data-color=primary])>[data-slot=field]:is([data-invalid],[aria-invalid=true]>*)]:[--focus-ring-color:--theme(--color-destructive)]
      `,
      list: `
        choice-row overflow-hidden rounded-control-md border border-border
        [&>[data-slot=field]]:px-4 [&>[data-slot=field]]:py-3
      `,
      table: `
        choice-row overflow-hidden rounded-control-md border border-border
        [&_[data-slot=field-description]]:text-body-sm
      `,
    },
    orientation: {
      vertical: "flex-col",
      horizontal: "flex-row",
    },
  },
  compoundVariants: [
    { variant: "default", orientation: "vertical", class: "gap-3" },
    { variant: "default", orientation: "horizontal", class: "flex-wrap gap-x-6 gap-y-3" },
    { variant: "card", orientation: "horizontal", class: "grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]" },
    { variant: ["list", "table"], orientation: "vertical", class: "divide-y" },
    { variant: ["list", "table"], orientation: "horizontal", class: "divide-x [&>[data-slot=field]]:flex-1" },
    {
      variant: "table",
      orientation: "vertical",
      class: `
        [&>[data-slot=field]]:grid [&>[data-slot=field]]:grid-cols-[auto_minmax(0,1fr)_minmax(0,2fr)]
        [&>[data-slot=field]]:items-center [&>[data-slot=field]]:gap-x-4 [&>[data-slot=field]]:px-4
        [&>[data-slot=field]]:py-2.5
        [&_[data-slot=field-content]]:contents
      `,
    },
    {
      variant: "table",
      orientation: "horizontal",
      class: `
        [&>[data-slot=field]]:flex-col [&>[data-slot=field]]:items-start [&>[data-slot=field]]:gap-3
        [&>[data-slot=field]]:p-4
      `,
    },
  ],
  defaultVariants: {
    variant: "default",
    orientation: "vertical",
  },
});

export type ChoiceGroupVariants = VariantProps<typeof choiceGroupVariants>;
