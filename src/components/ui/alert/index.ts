import { type VariantProps, cva } from "class-variance-authority";
import { createContext } from "reka-ui";
import type { ComputedRef } from "vue";

import type { ButtonSize } from "@/components/ui/button";

export { default as Alert } from "./Alert.vue";
export { default as AlertActions } from "./AlertActions.vue";
export { default as AlertClose } from "./AlertClose.vue";
export { default as AlertDescription } from "./AlertDescription.vue";
export { default as AlertTitle } from "./AlertTitle.vue";

export type AlertColor = "primary" | "neutral" | "destructive" | "success" | "warning" | "info";

export const alertVariants = cva(
  `
    group/alert relative grid w-full grid-cols-[auto_1fr] items-start
    data-[orientation=horizontal]:grid-cols-[auto_1fr_auto] data-[orientation=horizontal]:grid-rows-[1fr_auto_auto_1fr]
    [&>svg]:pointer-events-none [&>svg]:col-start-1 [&>svg]:row-start-1 [&>svg]:me-(--alert-gap)
    [&>svg]:h-(--alert-line) [&>svg]:w-(--alert-icon) [&>svg]:shrink-0
    data-[orientation=horizontal]:[&>svg]:row-span-full data-[orientation=horizontal]:[&>svg]:h-(--alert-icon)
    data-[orientation=horizontal]:[&>svg]:self-center
    [--alert-line:var(--typescale-title-sm-line-height)]
    has-data-[slot=alert-close]:pe-[calc(var(--alert-pad)+var(--alert-close))]
  `,
  {
    variants: {
      variant: {
        solid: "bg-tone text-tone-foreground",
        soft: "bg-tone-soft text-tone-soft-foreground",
        subtle: "bg-tone-soft text-tone-soft-foreground inset-ring inset-ring-tone-border-subtle",
        outline: "text-tone-text inset-ring inset-ring-tone-border",
        ghost: "text-tone-text",
        link: "text-tone-text underline-offset-4 hover:underline",
      },
      size: {
        xs: `
          rounded-surface-xs p-(--alert-pad) [--alert-pad:--spacing(2.5)] [--alert-gap:--spacing(2)]
          [--alert-icon:--spacing(3.5)] [--alert-close:var(--control-height-xs)]
        `,
        sm: `
          rounded-surface-xs p-(--alert-pad) [--alert-pad:--spacing(3)] [--alert-gap:--spacing(2)]
          [--alert-icon:--spacing(4)] [--alert-close:var(--control-height-xs)]
        `,
        md: `
          rounded-surface-sm p-(--alert-pad) [--alert-pad:--spacing(4)] [--alert-gap:--spacing(2.5)]
          [--alert-icon:--spacing(5)] [--alert-close:var(--control-height-sm)]
        `,
        lg: `
          rounded-surface-sm p-(--alert-pad) [--alert-pad:--spacing(5)] [--alert-gap:--spacing(3)]
          [--alert-icon:--spacing(5)] [--alert-close:var(--control-height-sm)]
        `,
        xl: `
          rounded-surface-md p-(--alert-pad) [--alert-pad:--spacing(6)] [--alert-gap:--spacing(3.5)]
          [--alert-icon:--spacing(6)] [--alert-close:var(--control-height-md)]
        `,
      },
    },
    defaultVariants: {
      variant: "solid",
      size: "md",
    },
  },
);

export type AlertVariants = VariantProps<typeof alertVariants>;
export type AlertSize = NonNullable<AlertVariants["size"]>;

export const alertCloseSize: Record<AlertSize, ButtonSize> = {
  xs: "icon-xs",
  sm: "icon-xs",
  md: "icon-sm",
  lg: "icon-sm",
  xl: "icon-md",
};

export const [injectAlertContext, provideAlertContext] = createContext<{
  close: () => void;
  size: ComputedRef<AlertSize>;
}>("Alert");
