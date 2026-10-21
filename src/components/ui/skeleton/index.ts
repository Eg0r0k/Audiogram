import { type VariantProps, cva } from "class-variance-authority";

export { default as Skeleton } from "./Skeleton.vue";

export type SkeletonColor = "primary" | "neutral" | "destructive" | "success" | "warning" | "info";

export const skeletonVariants = cva("bg-accent data-color:bg-tone-soft", {
  variants: {
    variant: {
      rect: "rounded-md",
      text: "my-[calc((1lh-1em)/2)] h-[1em] rounded-sm",
      circle: "aspect-square rounded-full",
    },
    animation: {
      pulse: "animate-pulse motion-reduce:animate-none",
      wave: "animate-skeleton-wave",
      none: "",
    },
  },
  defaultVariants: {
    variant: "rect",
    animation: "pulse",
  },
});

export type SkeletonVariants = VariantProps<typeof skeletonVariants>;
