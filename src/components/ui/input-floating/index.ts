import { type VariantProps, cva } from "class-variance-authority";

import { textControlBase, textControlRadius, textControlSize, textControlVariant } from "@/lib/text-control";

export { default as InputFloating } from "./InputFloating.vue";

const insideLabel: ("soft" | "filled" | "ghost" | "subtle")[] = ["soft", "filled", "ghost", "subtle"];

const sizes = { xs: "", sm: "", md: "", lg: "", xl: "" };

export const inputFloatingVariants = cva("group/floating relative", {
  variants: {
    variant: { outline: "", soft: "", filled: "", ghost: "", subtle: "" },
    size: sizes,
  },
  compoundVariants: [
    { variant: "outline", size: "xs", class: `h-(--control-height-xs) ${textControlRadius.xs}` },
    { variant: "outline", size: "sm", class: `h-(--control-height-sm) ${textControlRadius.sm}` },
    { variant: "outline", size: "md", class: `h-(--control-height-md) ${textControlRadius.md}` },
    { variant: "outline", size: "lg", class: `h-(--control-height-lg) ${textControlRadius.lg}` },
    { variant: "outline", size: "xl", class: `h-(--control-height-xl) ${textControlRadius.xl}` },
    { variant: insideLabel, size: "xs", class: "h-10 [--frame-radius:--theme(--radius-control-lg)]" },
    { variant: insideLabel, size: "sm", class: "h-11 [--frame-radius:--theme(--radius-control-lg)]" },
    { variant: insideLabel, size: "md", class: "h-12 [--frame-radius:--theme(--radius-control-xl)]" },
    { variant: insideLabel, size: "lg", class: "h-13 [--frame-radius:--theme(--radius-control-xl)]" },
    { variant: insideLabel, size: "xl", class: "h-14 [--frame-radius:--theme(--radius-control-xl)]" },
  ],
  defaultVariants: {
    variant: "outline",
    size: "md",
  },
});

export const inputFloatingInputVariants = cva(
  `${textControlBase} peer h-full placeholder:text-transparent focus:placeholder:text-muted-foreground`,
  {
    variants: {
      variant: { ...textControlVariant, outline: "rounded-(--frame-radius)" },
      size: textControlSize,
    },
    compoundVariants: [
      { variant: insideLabel, size: "xs", class: "pt-4.5" },
      { variant: insideLabel, size: "sm", class: "pt-5" },
      { variant: insideLabel, size: "md", class: "pt-5.5" },
      { variant: insideLabel, size: "lg", class: "pt-6" },
      { variant: insideLabel, size: "xl", class: "pt-6.5" },
    ],
    defaultVariants: {
      variant: "outline",
      size: "md",
    },
  },
);

const floatInside = `
  peer-focus:translate-y-0 peer-focus:text-body-sm
  peer-not-placeholder-shown:translate-y-0 peer-not-placeholder-shown:text-body-sm
  peer-autofill:translate-y-0 peer-autofill:text-body-sm
  group-data-float/floating:translate-y-0 group-data-float/floating:text-body-sm
`;

export const inputFloatingLabelVariants = cva(
  `
    pointer-events-none absolute top-1/2 -translate-y-1/2 truncate text-body-lg text-muted-foreground
    md:text-body-md
    transition-[top,translate,font-size,line-height,color] duration-short-4 ease-standard
    motion-reduce:transition-none
    peer-focus:text-primary
    peer-user-invalid:text-destructive
    peer-user-invalid:peer-focus:text-destructive
    peer-disabled:text-foreground/(--disabled-opacity)
    peer-aria-invalid:text-destructive
    peer-aria-invalid:peer-focus:text-destructive
  `,
  {
    variants: {
      variant: {
        outline: `
          peer-focus:top-0 peer-focus:text-body-sm
          peer-not-placeholder-shown:top-0 peer-not-placeholder-shown:text-body-sm
          peer-autofill:top-0 peer-autofill:text-body-sm
          group-data-float/floating:top-0 group-data-float/floating:text-body-sm
        `,
        soft: floatInside,
        filled: floatInside,
        ghost: floatInside,
        subtle: floatInside,
      },
      size: {
        xs: "start-(--control-padding-xs) max-w-[calc(100%-var(--control-padding-xs)*2)] md:text-body-sm",
        sm: "start-(--control-padding-sm) max-w-[calc(100%-var(--control-padding-sm)*2)]",
        md: "start-(--control-padding-md) max-w-[calc(100%-var(--control-padding-md)*2)]",
        lg: "start-(--control-padding-lg) max-w-[calc(100%-var(--control-padding-lg)*2)]",
        xl: "start-(--control-padding-xl) max-w-[calc(100%-var(--control-padding-xl)*2)] md:text-body-lg",
      },
    },
    compoundVariants: [
      {
        variant: insideLabel,
        size: "xs",
        class: `
          peer-focus:top-0.5
          peer-not-placeholder-shown:top-0.5
          peer-autofill:top-0.5
          group-data-float/floating:top-0.5
        `,
      },
      {
        variant: insideLabel,
        size: "sm",
        class: "peer-focus:top-1 peer-not-placeholder-shown:top-1 peer-autofill:top-1 group-data-float/floating:top-1",
      },
      {
        variant: insideLabel,
        size: "md",
        class: `
          peer-focus:top-1.5
          peer-not-placeholder-shown:top-1.5
          peer-autofill:top-1.5
          group-data-float/floating:top-1.5
        `,
      },
      {
        variant: insideLabel,
        size: ["lg", "xl"],
        class: "peer-focus:top-2 peer-not-placeholder-shown:top-2 peer-autofill:top-2 group-data-float/floating:top-2",
      },
    ],
    defaultVariants: {
      variant: "outline",
      size: "md",
    },
  },
);

export const inputFloatingOutlineVariants = cva(
  `
    pointer-events-none absolute inset-x-0 -top-[5px] bottom-0 m-0 min-w-0 rounded-(--frame-radius) border border-input
    transition-[border-color] duration-short-3 ease-standard
    peer-focus-visible:border-2 peer-focus-visible:border-primary
    peer-user-invalid:border-destructive
    peer-user-invalid:peer-focus-visible:border-destructive
    peer-disabled:border-foreground/(--disabled-container-opacity)
    peer-aria-invalid:border-destructive
    peer-aria-invalid:peer-focus-visible:border-destructive
  `,
  {
    variants: {
      size: { xs: "px-1", sm: "px-1.5", md: "px-2", lg: "px-2", xl: "px-3" },
    },
    defaultVariants: { size: "md" },
  },
);

export const inputFloatingLegendVariants = cva(
  `
    invisible float-none h-2.5 max-w-0 overflow-hidden p-0 text-body-sm whitespace-nowrap transition-[max-width]
    duration-short-2 ease-standard
    motion-reduce:transition-none
    group-data-float/floating:max-w-full group-data-float/floating:px-1
    [.peer:focus~fieldset_&]:max-w-full [.peer:focus~fieldset_&]:px-1
    [.peer:not(:placeholder-shown)~fieldset_&]:max-w-full [.peer:not(:placeholder-shown)~fieldset_&]:px-1
    [.peer:autofill~fieldset_&]:max-w-full [.peer:autofill~fieldset_&]:px-1
    [.peer:-webkit-autofill~fieldset_&]:max-w-full [.peer:-webkit-autofill~fieldset_&]:px-1
  `,
);

export type InputFloatingVariants = VariantProps<typeof inputFloatingVariants>;
export type InputFloatingSize = NonNullable<InputFloatingVariants["size"]>;
