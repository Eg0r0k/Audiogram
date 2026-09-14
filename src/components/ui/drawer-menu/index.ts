import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";

export { default as DrawerMenuCheckboxItem } from "./DrawerMenuCheckboxItem.vue";
export { default as DrawerMenuGroup } from "./DrawerMenuGroup.vue";
export { default as DrawerMenuItem } from "./DrawerMenuItem.vue";
export { default as DrawerMenuLabel } from "./DrawerMenuLabel.vue";
export { default as DrawerMenuRadioGroup } from "./DrawerMenuRadioGroup.vue";
export { default as DrawerMenuRadioItem } from "./DrawerMenuRadioItem.vue";
export { default as DrawerMenuSeparator } from "./DrawerMenuSeparator.vue";
export { default as DrawerMenuSub } from "./DrawerMenuSub.vue";
export { default as DrawerMenuSubContent } from "./DrawerMenuSubContent.vue";
export { default as DrawerMenuSubTrigger } from "./DrawerMenuSubTrigger.vue";

export const drawerMenuRowVariants = cva(
  "press-scale relative flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-base font-medium outline-none select-none hover:bg-accent active:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='text-'])]:text-muted-foreground",
  {
    variants: {
      variant: {
        default: "text-foreground",
        destructive: "text-destructive *:[svg]:!text-destructive hover:bg-destructive/10 active:bg-destructive/10 focus-visible:bg-destructive/10 dark:hover:bg-destructive/20 dark:active:bg-destructive/20 dark:focus-visible:bg-destructive/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type DrawerMenuRowVariants = VariantProps<typeof drawerMenuRowVariants>;
