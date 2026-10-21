import { type VariantProps, cva } from "class-variance-authority";

export { default as Empty } from "./Empty.vue";
export { default as EmptyContent } from "./EmptyContent.vue";
export { default as EmptyDescription } from "./EmptyDescription.vue";
export { default as EmptyHeader } from "./EmptyHeader.vue";
export { default as EmptyMedia } from "./EmptyMedia.vue";
export { default as EmptyTitle } from "./EmptyTitle.vue";

export const emptyVariants = cva(
  "group/empty flex min-w-0 flex-1 flex-col items-center justify-center text-center text-balance",
  {
    variants: {
      size: {
        xs: "gap-3 p-4 [--empty-icon:--spacing(6)] [--empty-header-gap:--spacing(1.5)] [--empty-content-gap:--spacing(3)]",
        sm: "gap-4 p-6 [--empty-icon:--spacing(8)] [--empty-header-gap:--spacing(1.5)] [--empty-content-gap:--spacing(3)]",
        md: "gap-4 p-6 md:p-12 [--empty-icon:--spacing(10)] [--empty-header-gap:--spacing(2)] [--empty-content-gap:--spacing(4)]",
        lg: "gap-8 p-10 [--empty-icon:--spacing(12)] [--empty-header-gap:--spacing(3)] [--empty-content-gap:--spacing(5)]",
        xl: `
          gap-10 p-12 [--empty-icon:--spacing(14)] [--empty-header-gap:--spacing(3)] [--empty-content-gap:--spacing(5)]
        `,
      },
    },
    defaultVariants: { size: "md" },
  },
);

export type EmptyVariants = VariantProps<typeof emptyVariants>;
export type EmptySize = NonNullable<EmptyVariants["size"]>;
