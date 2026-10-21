import { type VariantProps, cva } from "class-variance-authority";
import { createContext } from "reka-ui";
import type { ComputedRef } from "vue";

export { default as Slider } from "./Slider.vue";
export { default as SliderHandle } from "./SliderHandle.vue";
export { default as SliderRange } from "./SliderRange.vue";
export { default as SliderThumb } from "./SliderThumb.vue";
export { default as SliderTrack } from "./SliderTrack.vue";

export type SliderColor = "primary" | "neutral" | "destructive" | "success" | "warning" | "info";

export const sliderVariants = cva(
  `
    group/slider relative flex h-(--slider-h) w-(--slider-w) touch-none items-center select-none slider-axis
    tone-control
    has-[[aria-invalid=true]]:tone-invalid
    data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:flex-col
    data-disabled:cursor-not-allowed
  `,
  {
    variants: {
      variant: {
        default: "[--slider-size:var(--slider-thumb)] [--slider-track:var(--slider-bar)]",
        inset: `
          [--slider-size:var(--slider-track)] [--slider-track:calc(var(--slider-thumb)+0.25rem)]
          [--slider-half:calc(var(--slider-track)/2)]
        `,
      },
      size: {
        xs: "[--slider-thumb:0.75rem] [--slider-bar:0.25rem]",
        sm: "[--slider-thumb:0.875rem] [--slider-bar:0.375rem]",
        md: "[--slider-thumb:1rem] [--slider-bar:0.375rem]",
        lg: "[--slider-thumb:1.25rem] [--slider-bar:0.5rem]",
        xl: "[--slider-thumb:1.5rem] [--slider-bar:0.625rem]",
      },
      touchTarget: {
        none: "",
        expand: "slider-touch",
        wrapper: "slider-touch touch-target-margin",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
      touchTarget: "none",
    },
  },
);

export const sliderTrackVariants = cva(
  "relative h-(--track-h) w-(--track-w) grow rounded-full data-disabled:bg-foreground/(--disabled-container-opacity)",
  {
    variants: {
      variant: {
        default: "overflow-hidden bg-muted",
        inset: "border-x-(length:--track-inset-x) border-y-(length:--track-inset-y) border-transparent bg-muted",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export const sliderRangeVariants = cva("absolute h-(--range-h) w-(--range-w)", {
  variants: {
    variant: {
      default: "rounded-full bg-tone-text data-disabled:bg-foreground/(--disabled-opacity)",
      inset: `
        slider-range-inset bg-tone
        data-disabled:bg-[color-mix(in_oklab,--theme(--color-foreground)_var(--disabled-opacity),--theme(--color-background))]
      `,
    },
  },
  defaultVariants: { variant: "default" },
});

export const sliderThumbVariants = cva(
  `
    group/thumb relative flex size-(--slider-size) shrink-0 items-center justify-center rounded-full outline-none
    focus-visible:focus-ring
  `,
  {
    variants: {
      variant: {
        default: "state-halo [--halo-size:calc(var(--slider-thumb)+1.5rem)]",
        inset: `
          bg-tone
          data-disabled:bg-[color-mix(in_oklab,--theme(--color-foreground)_var(--disabled-opacity),--theme(--color-background))]
        `,
      },
      touchTarget: {
        none: "",
        expand: "touch-target",
        wrapper: "touch-target",
      },
    },
    defaultVariants: {
      variant: "default",
      touchTarget: "none",
    },
  },
);

export const sliderHandleVariants = cva(
  `
    pointer-events-none block size-(--slider-thumb) rounded-full shadow-shadow-sm transition-[scale,background-color]
    duration-short-4 ease-standard
    group-data-disabled/thumb:shadow-none
    motion-reduce:transition-none
  `,
  {
    variants: {
      variant: {
        default: `
          group-active/slider:group-focus/thumb:scale-125 group-active/slider:group-focus/thumb:duration-short-2
          group-data-disabled/thumb:bg-[color-mix(in_oklab,--theme(--color-foreground)_var(--disabled-opacity),--theme(--color-background))]
        `,
        inset: `
          bg-tone-foreground
          group-active/slider:group-focus/thumb:scale-90 group-active/slider:group-focus/thumb:duration-short-2
          group-data-disabled/thumb:bg-background
        `,
      },
      // The shade of a default handle: Slider draws it on the page in --tone-text; ColorPicker shows the colour itself.
      shade: {
        fill: "",
        text: "",
      },
    },
    compoundVariants: [
      { variant: "default", shade: "fill", class: "bg-tone" },
      { variant: "default", shade: "text", class: "border-2 border-tone-text bg-background shadow-none" },
    ],
    defaultVariants: { variant: "default", shade: "fill" },
  },
);

export type SliderVariants = VariantProps<typeof sliderVariants>;
export type SliderSize = NonNullable<SliderVariants["size"]>;

export const [injectSliderContext, provideSliderContext] = createContext<{
  variant: ComputedRef<SliderVariants["variant"]>;
  touchTarget: ComputedRef<SliderVariants["touchTarget"]>;
  thumbAttrs: ComputedRef<Record<string, unknown>>;
}>("Slider");
