import { type VariantProps, cva } from "class-variance-authority";
import { type Color, createContext } from "reka-ui";
import type { ComputedRef, Ref } from "vue";

export { default as ColorPicker } from "./ColorPicker.vue";
export { default as ColorPickerArea } from "./ColorPickerArea.vue";
export { default as ColorPickerField } from "./ColorPickerField.vue";
export { default as ColorPickerPreview } from "./ColorPickerPreview.vue";
export { default as ColorPickerSlider } from "./ColorPickerSlider.vue";
export { default as ColorPickerSwatch } from "./ColorPickerSwatch.vue";
export { default as ColorPickerSwatches } from "./ColorPickerSwatches.vue";

export type ColorPickerFormat = "hex" | "rgb" | "hsl" | "hsb";
export type ColorPickerSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface ColorPickerContext {
  color: Ref<Color>;
  hex: ComputedRef<string>;
  opaque: ComputedRef<string>;
  setColor: (color: Color) => void;
  size: Ref<ColorPickerSize>;
  disabled: ComputedRef<boolean>;
  invalid: ComputedRef<boolean | "true" | "false" | undefined>;
  describedBy: ComputedRef<string | undefined>;
}

export const [injectColorPickerContext, provideColorPickerContext] = createContext<ColorPickerContext>("ColorPicker");

export const colorPickerVariants = cva("group/color-picker flex flex-col gap-(--color-picker-gap)", {
  variants: {
    size: {
      xs: `
        [--color-picker-area:--spacing(24)] [--color-picker-control:var(--control-height-xs)]
        [--color-picker-gap:--spacing(2)] [--color-picker-radius:--theme(--radius-control-xs)]
        [--color-picker-swatch:--spacing(5)] [--slider-thumb:0.75rem]
      `,
      sm: `
        [--color-picker-area:--spacing(32)] [--color-picker-control:var(--control-height-sm)]
        [--color-picker-gap:--spacing(2)] [--color-picker-radius:--theme(--radius-control-sm)]
        [--color-picker-swatch:--spacing(6)] [--slider-thumb:0.875rem]
      `,
      md: `
        [--color-picker-area:--spacing(40)] [--color-picker-control:var(--control-height-md)]
        [--color-picker-gap:--spacing(3)] [--color-picker-radius:--theme(--radius-control-md)]
        [--color-picker-swatch:--spacing(7)] [--slider-thumb:1rem]
      `,
      lg: `
        [--color-picker-area:--spacing(48)] [--color-picker-control:var(--control-height-lg)]
        [--color-picker-gap:--spacing(3)] [--color-picker-radius:--theme(--radius-control-lg)]
        [--color-picker-swatch:--spacing(8)] [--slider-thumb:1.25rem]
      `,
      xl: `
        [--color-picker-area:--spacing(56)] [--color-picker-control:var(--control-height-xl)]
        [--color-picker-gap:--spacing(4)] [--color-picker-radius:--theme(--radius-control-xl)]
        [--color-picker-swatch:--spacing(9)] [--slider-thumb:1.5rem]
      `,
    },
  },
  defaultVariants: { size: "md" },
});

export type ColorPickerVariants = VariantProps<typeof colorPickerVariants>;

export const colorPickerChecker
  = "bg-[repeating-conic-gradient(--theme(--color-border)_0_25%,transparent_0_50%)] bg-size-[0.75rem_0.75rem]";

export const colorPickerArea = `
  group/slider relative h-(--color-picker-area) w-full [--slider-size:var(--slider-thumb)]
  data-disabled:opacity-(--disabled-opacity)
`;

export const colorPickerAreaCanvas = "absolute inset-0 rounded-(--color-picker-radius)";

export const colorPickerAreaHandle = "ring-2 ring-background";

export const colorPickerSliderChecker = `absolute inset-0 m-auto h-(--track-h) w-(--track-w) rounded-full ${colorPickerChecker}`;

export const colorPickerPreview = `relative size-(--color-picker-control) shrink-0 rounded-(--color-picker-radius) ${colorPickerChecker}`;

export const colorPickerPreviewColor
  = "absolute inset-0 rounded-[inherit] bg-(--reka-color-swatch-color) inset-ring inset-ring-surface-border";

export const colorPickerSwatches = "flex flex-wrap gap-2 outline-none data-disabled:opacity-(--disabled-opacity)";

export const colorPickerSwatch = `
  relative size-(--color-picker-swatch) shrink-0 cursor-pointer rounded-full outline-none
  focus-visible:focus-ring
  data-disabled:cursor-not-allowed data-disabled:opacity-(--disabled-opacity)
  ${colorPickerChecker}`;

export const colorPickerSwatchColor
  = "peer/swatch absolute inset-0 rounded-[inherit] bg-(--reka-color-swatch-color) inset-ring inset-ring-surface-border";

export const colorPickerSwatchIndicator = `
  absolute inset-0 flex items-center justify-center text-white
  peer-data-[color-contrast=dark]/swatch:text-black
  [&_svg]:size-[55%]
`;
